/** Swarm upload/read gateway plumbing + local file-URI materialisation for the
 *  app's XMTP remote-attachment flow. Extracted from lib/xmtp.ts (phase-2 lint
 *  split); `swarmToHttp` is re-exported from lib/xmtp.ts. KEEP all upload/url
 *  behavior byte-identical. */

import { File, Paths } from 'expo-file-system';

/** Pineapple = Snapshot's IPFS pinning gateway. Reused from the avatar-upload
 *  path (`lib/profile.ts`); attachments are encrypted client-side before upload,
 *  so the public CID only ever exposes ciphertext. */
/** Metro daemon Swarm upload-proxy (cloudflared named tunnel → swarmproxy train).
 *  The encrypted ciphertext is POSTed here as a raw binary body; the daemon holds
 *  the swarmy API key server-side and returns `{ ref: "<swarmReference>" }`. Not a
 *  secret — just the public host of the proxy endpoint. */
export const SWARM_UPLOAD_URL = 'https://blob.metro.box/upload';
/** Public KEYLESS Swarm read gateway. Reads need no daemon and no key — the bytes
 *  are fetched straight from any Swarm gateway by reference. The trailing slash is
 *  required (the `/bzz/<ref>/` form returns the exact original bytes; `/bytes`
 *  returns swarm-framed junk). */
export const SWARM_GATEWAY = 'https://api.swarmy.cloud/bzz/';

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

/** Upload an encrypted attachment's ciphertext to Swarm (via the Metro daemon
 *  proxy) and return the public KEYLESS HTTPS URL the recipient fetches from.
 *
 *  The ciphertext is read off disk into a single binary body and POSTed raw to the
 *  daemon proxy (`SWARM_UPLOAD_URL`), which re-uploads it to swarmy.cloud with the
 *  server-side API key and returns `{ ref }`. We then return the keyless public
 *  gateway URL `https://api.gateway.ethswarm.org/bzz/<ref>/` — reads never touch
 *  the daemon. The blob is already client-side encrypted, so the public reference
 *  only ever exposes ciphertext. */
export async function uploadEncryptedToIpfs(encryptedFileUri: string, filename: string): Promise<string> {
  /** Read the encrypted bytes off disk; `fetch(file://)` gives us a Blob we can
   *  ship as a raw binary body (the proxy reads `req.arrayBuffer()`). */
  const blob = await (await fetch(encryptedFileUri)).blob();
  const res = await fetch(SWARM_UPLOAD_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: blob,
  });
  const json = await res.json().catch(() => ({})) as { ref?: string; error?: string; status?: number };
  /** swarmy enforces a ~1MB body cap → 413. Surface a clear, actionable message
   *  instead of a raw 502/"Swarm upload failed". */
  if (res.status === 413 || json.status === 413) {
    throw new Error(`"${filename}" is too large to send (max ~1MB). Try a smaller file.`);
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
