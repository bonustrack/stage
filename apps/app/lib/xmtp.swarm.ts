/** @file Swarm upload/read gateway plumbing and local file-URI materialisation (with the branded `SanitizedFileUri` strip boundary) for the XMTP remote-attachment flow; extracted from lib/xmtp.ts, with `swarmToHttp` re-exported there. */

import { File, Paths } from 'expo-file-system';
import { stripMetadataBytes, isStrippableImage } from './stripMetadata';

/** `SanitizedFileUri` is a NOMINAL (branded) string only `sanitizeFileUri` produces, so the encrypt boundary that accepts only this type makes handing it a raw un-sanitised uri a TYPE ERROR; the phantom `unique symbol` brand has zero runtime footprint. */
declare const sanitizedBrand: unique symbol;
export type SanitizedFileUri = string & { readonly [sanitizedBrand]: true };

/** Metro daemon Swarm upload-proxy: encrypted ciphertext is POSTed as a raw binary body, the daemon holds the swarmy API key server-side and returns `{ ref }`; not a secret, just the public proxy host. */
const SWARM_UPLOAD_URL = 'https://blob.metro.box/upload';
/** Public KEYLESS Swarm read gateway: bytes are fetched by reference with no daemon or key, and the trailing slash is required (the `/bzz/<ref>/` form returns the exact original bytes, unlike `/bytes`). */
const SWARM_GATEWAY = 'https://api.swarmy.cloud/bzz/';

/** Resolve a gateway-agnostic `swarm://<ref>` URL to a concrete HTTPS read URL on the default gateway (picked only at fetch time, so a gateway swap needs no message rewrite); any non-`swarm://` url (e.g. legacy full gateway URLs) passes through unchanged. */
export function swarmToHttp(url: string): string {
  if (!url.startsWith('swarm://')) return url;
  const ref = url.slice('swarm://'.length).replace(/\/+$/, '');
  return `${SWARM_GATEWAY}${ref}/`;
}

/** Extension → MIME fallback for the formats the composer can stage. Mirrors the composer's table; used as a last resort when a picker/recorder hands back an empty MIME so the native encoder never receives `''`. */
export const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

/** Resolve any staged source URI to a real on-disk `file://` URI (required by `client.encryptAttachment`): `file://` passes through, other schemes are streamed into the cache dir via `fetch().blob()` + `File.write`. */
export async function materializeFileUri(src: string): Promise<string> {
  if (src.startsWith('file://')) return src;
  /** Bare absolute path (no scheme) — just prefix it. */
  if (src.startsWith('/')) return `file://${src}`;
  const ext = src.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  const dest = freshCacheFile('xmtp-send', ext.length <= 5 ? ext : 'bin');
  const blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  dest.create();
  dest.write(buf);
  return toFileUri(dest.uri);
}

/** A fresh, uniquely-named cache File for `prefix`/`ext`, with any pre-existing one deleted. */
function freshCacheFile(prefix: string, ext: string): File {
  const tmpName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  return dest;
}

/** Normalise a possibly schemeless cache uri to a `file://` uri. */
function toFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

/** The single chokepoint that force-strips EXIF/GPS/etc from every staged image via the pure-JS rewriter before encrypt/upload, returning the branded `SanitizedFileUri` (its only producer); non-strippable formats and failures brand the ORIGINAL uri so a send is never blocked. */
export async function sanitizeFileUri(
  uri: string, mimeType: string | undefined, filename: string | undefined,
): Promise<SanitizedFileUri> {
  if (!isStrippableImage(mimeType, filename)) return uri as SanitizedFileUri;
  try {
    const blob = await (await fetch(uri)).blob();
    const input = new Uint8Array(await blob.arrayBuffer());
    const { bytes, stripped } = stripMetadataBytes(input);
    if (!stripped || bytes.length === input.length && bytes.every((v, k) => v === input[k])) {
      return uri as SanitizedFileUri; /** nothing removed (no metadata present) - keep original file */
    }
    return writeCleanImage(bytes, filename, uri);
  } catch {
    return uri as SanitizedFileUri; /** never block a send on a strip failure */
  }
}

/** Write stripped image bytes to a fresh cache file and return its branded SanitizedFileUri. */
function writeCleanImage(
  bytes: Uint8Array, filename: string | undefined, uri: string,
): SanitizedFileUri {
  const ext = (filename ?? uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'img';
  const dest = freshCacheFile('xmtp-clean', ext.length <= 5 ? ext : 'img');
  dest.create();
  dest.write(bytes);
  return toFileUri(dest.uri) as SanitizedFileUri;
}

/** Max ciphertext we'll attempt to upload: guards just below the daemon proxy's ~12MB so a send fails fast with a clear message; note swarmy.cloud's nginx still hard-caps upstream at ~1MB, so files between 1MB and this limit reach the proxy but 413 at swarmy. */
const SWARM_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

/** Upload an already-encrypted file to Swarm via the daemon proxy and return its public gateway URL. */
export async function uploadEncryptedToIpfs(encryptedFileUri: string, filename: string): Promise<string> {
  /** Read the encrypted bytes off disk; `fetch(file://)` gives us a Blob we can ship as a raw binary body (the proxy reads `req.arrayBuffer()`). */
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
  /** swarmy's nginx still enforces a ~1MB body cap → 413. Surface a clear, actionable message instead of a raw 502/"Swarm upload failed". */
  if (res.status === 413 || json.status === 413) {
    throw new Error(`"${filename}" is too large to send (server max ~1MB). Try a smaller file.`);
  }
  if (!res.ok || json.error) throw new Error(json.error ?? `Swarm upload failed (${res.status})`);
  if (!json.ref) throw new Error('Swarm proxy returned no reference');
  /** Store a concrete HTTPS gateway URL (never `swarm://<ref>`): the native XMTP SDK validates and rejects non-http(s) attachment schemes at send time; reads still pass through `swarmToHttp`, which leaves https urls unchanged. */
  return `${SWARM_GATEWAY}${json.ref}/`;
}
