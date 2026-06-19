/** Swarm upload/read gateway plumbing + local file-URI materialisation for the
 *  app's XMTP remote-attachment flow. Extracted from lib/xmtp.ts (phase-2 lint
 *  split); `swarmToHttp` is re-exported from lib/xmtp.ts. KEEP all upload/url
 *  behavior byte-identical. */

import { File, Paths } from 'expo-file-system';
import { stripMetadataBytes, isStrippableImage } from './stripMetadata';

/** Compile-time guarantee that the outbound file-metadata strip cannot be
 *  bypassed. `SanitizedFileUri` is a NOMINAL (branded) string: a plain `string`
 *  is NOT assignable to it. The ONLY function that produces one is
 *  `sanitizeFileUri` below - it runs the strip, then brands the result. The
 *  encrypt boundary (`encryptSanitizedAttachment`) accepts ONLY this type, so a
 *  future send path that hands a raw, un-sanitised uri to the encoder is a TYPE
 *  ERROR. Bypassing the strip therefore requires a deliberate, reviewable `as
 *  SanitizedFileUri` cast - it can no longer happen by accident. The brand is a
 *  phantom field (a `unique symbol`); it has zero runtime footprint - at runtime
 *  a `SanitizedFileUri` is just the string uri. */
declare const sanitizedBrand: unique symbol;
export type SanitizedFileUri = string & { readonly [sanitizedBrand]: true };

/** Pineapple = Snapshot's IPFS pinning gateway. Reused from the avatar-upload
 *  path (`lib/profile.ts`); attachments are encrypted client-side before upload,
 *  so the public CID only ever exposes ciphertext. */
/** Metro daemon Swarm upload-proxy (cloudflared named tunnel → swarmproxy train).
 *  The encrypted ciphertext is POSTed here as a raw binary body; the daemon holds
 *  the swarmy API key server-side and returns `{ ref: "<swarmReference>" }`. Not a
 *  secret — just the public host of the proxy endpoint. */
const SWARM_UPLOAD_URL = 'https://blob.metro.box/upload';
/** Public KEYLESS Swarm read gateway. Reads need no daemon and no key — the bytes
 *  are fetched straight from any Swarm gateway by reference. The trailing slash is
 *  required (the `/bzz/<ref>/` form returns the exact original bytes; `/bytes`
 *  returns swarm-framed junk). */
const SWARM_GATEWAY = 'https://api.swarmy.cloud/bzz/';

/** Resolve a gateway-agnostic `swarm://<ref>` URL to a concrete HTTPS read URL on
 *  the default gateway. Stored messages carry `swarm://<ref>` (no gateway baked
 *  in) so a future gateway swap needs no message rewrite — we pick a real gateway
 *  only at fetch time. Backward-compat: legacy messages (≤ ec2a2ce) carry a full
 *  `https://…/bzz/<ref>/` URL; those — and any other non-`swarm://` url — pass
 *  through unchanged so they still resolve. */
export function swarmToHttp(url: string): string {
  if (!url.startsWith('swarm://')) return url;
  const ref = url.slice('swarm://'.length).replace(/\/+$/, '');
  return `${SWARM_GATEWAY}${ref}/`;
}

/** Extension → MIME fallback for the formats the composer can stage. Mirrors the
 *  composer's table; used as a last resort when a picker/recorder hands back an
 *  empty MIME so the native encoder never receives `''`. */
export const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

/** Resolve any staged source URI to a real on-disk `file://` URI.
 *
 *  `client.encryptAttachment` rejects anything that doesn't start with `file://`.
 *  A plain `file://` source is returned as-is. Other schemes (`content://` on
 *  Android, `blob:` / `data:` on web, bare paths) are streamed into the cache dir
 *  via `fetch().blob()` + `File.write` so the native side gets a path it can
 *  read. */
export async function materializeFileUri(src: string): Promise<string> {
  if (src.startsWith('file://')) return src;
  /** Bare absolute path (no scheme) — just prefix it. */
  if (src.startsWith('/')) return `file://${src}`;
  const ext = src.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  const tmpName = `xmtp-send-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.length <= 5 ? ext : 'bin'}`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  const blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  dest.create();
  dest.write(buf);
  return dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`;
}

/** Force-strip embedded metadata (EXIF/GPS/XMP/ICC/timestamps) from a staged
 *  `file://` image before it is encrypted and uploaded. Reads the bytes off disk,
 *  runs them through the pure-JS container rewriter (`stripMetadataBytes`), and -
 *  if anything changed - writes the sanitised bytes to a fresh cache file whose
 *  uri is returned. Non-image / unsupported formats (video, docs, HEIC) return
 *  the input uri UNCHANGED: we never claim a file is clean when we cannot strip
 *  it. Failures fall back to the original uri so a send is never blocked.
 *
 *  This is the single chokepoint: `xmtpSendMultiRemoteAttachment` calls it for
 *  every non-audio attachment, so EVERY image send is sanitised, not optionally.
 *
 *  Returns a branded `SanitizedFileUri` - the ONLY producer of that type. The
 *  encrypt boundary requires it, so the strip cannot be skipped (see the
 *  `SanitizedFileUri` doc). The non-strippable / unchanged / failure branches
 *  brand the ORIGINAL uri: that is correct because those formats are not a
 *  metadata-leak vector we can strip in pure JS (video/doc/HEIC) - the brand
 *  asserts "this uri has been through the strip gate", not "bytes were removed". */
export async function sanitizeFileUri(
  uri: string, mimeType: string | undefined, filename: string | undefined,
): Promise<SanitizedFileUri> {
  if (!isStrippableImage(mimeType, filename)) return uri as SanitizedFileUri;
  try {
    const blob = await (await fetch(uri)).blob();
    const input = new Uint8Array(await blob.arrayBuffer());
    const { bytes, stripped } = stripMetadataBytes(input);
    if (!stripped || bytes.length === input.length && bytes.every((v, k) => v === input[k])) {
      return uri as SanitizedFileUri; // nothing removed (no metadata present) - keep original file
    }
    const ext = (filename ?? uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'img';
    const dest = new File(Paths.cache, `xmtp-clean-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext.length <= 5 ? ext : 'img'}`);
    if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
    dest.create();
    dest.write(bytes);
    const clean = dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`;
    return clean as SanitizedFileUri;
  } catch {
    return uri as SanitizedFileUri; // never block a send on a strip failure
  }
}

/** Upload an encrypted attachment's ciphertext to Swarm (via the Metro daemon
 *  proxy) and return the public KEYLESS HTTPS URL the recipient fetches from.
 *
 *  The ciphertext is read off disk into a single binary body and POSTed raw to the
 *  daemon proxy (`SWARM_UPLOAD_URL`), which re-uploads it to swarmy.cloud with the
 *  server-side API key and returns `{ ref }`. We then return the keyless public
 *  gateway URL `https://api.gateway.ethswarm.org/bzz/<ref>/` — reads never touch
 *  the daemon. The blob is already client-side encrypted, so the public reference
 *  only ever exposes ciphertext. */
/** Max ciphertext we'll attempt to upload. The daemon proxy accepts up to ~12MB;
 *  this guards a touch below so the send fails fast with a clear message instead
 *  of buffering a huge body. NOTE: swarmy.cloud's nginx still hard-caps
 *  /api/files at ~1MB upstream — files between 1MB and this limit reach the proxy
 *  but currently 413 at swarmy until that cap is lifted (or the store changes). */
const SWARM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Upload an already-encrypted file to Swarm via the daemon proxy and return its public gateway URL. */
export async function uploadEncryptedToIpfs(encryptedFileUri: string, filename: string): Promise<string> {
  /** Read the encrypted bytes off disk; `fetch(file://)` gives us a Blob we can
   *  ship as a raw binary body (the proxy reads `req.arrayBuffer()`). */
  const blob = await (await fetch(encryptedFileUri)).blob();
  if (blob.size > SWARM_UPLOAD_MAX_BYTES) {
    const mb = (SWARM_UPLOAD_MAX_BYTES / (1024 * 1024)).toFixed(0);
    throw new Error(`"${filename}" is too large to send (max ~${mb}MB). Try a smaller file.`);
  }
  const res = await fetch(SWARM_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  const json = await res.json().catch(() => ({})) as { ref?: string; error?: string; status?: number };
  /** swarmy's nginx still enforces a ~1MB body cap → 413. Surface a clear,
   *  actionable message instead of a raw 502/"Swarm upload failed". */
  if (res.status === 413 || json.status === 413) {
    throw new Error(`"${filename}" is too large to send (server max ~1MB). Try a smaller file.`);
  }
  if (!res.ok || json.error) throw new Error(json.error ?? `Swarm upload failed (${res.status})`);
  if (!json.ref) throw new Error('Swarm proxy returned no reference');
  /** Store a concrete HTTPS gateway URL in the message. The native XMTP SDK
   *  validates the attachment url at send time and rejects non-http(s) schemes
   *  (`java.net.MalformedURLException: unknown protocol: swarm`), so we must NOT
   *  store a `swarm://<ref>` url here. Reads still pass through `swarmToHttp`,
   *  which leaves https urls unchanged (and maps any legacy `swarm://` ones). */
  return `${SWARM_GATEWAY}${json.ref}/`;
}
