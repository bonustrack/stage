
import { File, Paths } from 'expo-file-system';
import { stripMetadataBytes, isStrippableImage } from '@stage-labs/client/image/stripMetadata';
import { SWARM_UPLOAD_MAX_BYTES, tooLargeError, uploadFormToSwarmy } from './swarmy';

export { swarmToHttp } from './swarmy';

declare const sanitizedBrand: unique symbol;
export type SanitizedFileUri = string & { readonly [sanitizedBrand]: true };

export const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif',
  webp: 'image/webp', heic: 'image/heic', heif: 'image/heif', bmp: 'image/bmp',
  m4a: 'audio/m4a', mp3: 'audio/mpeg', wav: 'audio/wav', aac: 'audio/aac',
  ogg: 'audio/ogg', caf: 'audio/x-caf', mp4: 'video/mp4', mov: 'video/quicktime',
  webm: 'video/webm', pdf: 'application/pdf',
};

export async function materializeFileUri(src: string): Promise<string> {
  if (src.startsWith('file://')) return src;
  if (src.startsWith('/')) return `file://${src}`;
  const ext = src.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  const dest = freshCacheFile('xmtp-send', ext.length <= 5 ? ext : 'bin');
  const blob = await (await fetch(src)).blob();
  const buf = new Uint8Array(await blob.arrayBuffer());
  dest.create();
  dest.write(buf);
  return toFileUri(dest.uri);
}

function freshCacheFile(prefix: string, ext: string): File {
  const tmpName = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { }
  return dest;
}

function toFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

export async function sanitizeFileUri(
  uri: string, mimeType: string | undefined, filename: string | undefined,
): Promise<SanitizedFileUri> {
  if (!isStrippableImage(mimeType, filename)) return uri as SanitizedFileUri;
  try {
    const blob = await (await fetch(uri)).blob();
    const input = new Uint8Array(await blob.arrayBuffer());
    const { bytes, stripped } = stripMetadataBytes(input);
    if (!stripped || bytes.length === input.length && bytes.every((v, k) => v === input[k])) {
      return uri as SanitizedFileUri;
    }
    return writeCleanImage(bytes, filename, uri);
  } catch {
    return uri as SanitizedFileUri;
  }
}

function writeCleanImage(
  bytes: Uint8Array, filename: string | undefined, uri: string,
): SanitizedFileUri {
  const ext = (filename ?? uri).split('?')[0]?.split('.').pop()?.toLowerCase() ?? 'img';
  const dest = freshCacheFile('xmtp-clean', ext.length <= 5 ? ext : 'img');
  dest.create();
  dest.write(bytes);
  return toFileUri(dest.uri) as SanitizedFileUri;
}

export async function uploadEncryptedToIpfs(encryptedFileUri: string, filename: string): Promise<string> {
  const blob = await (await fetch(encryptedFileUri)).blob();
  if (blob.size > SWARM_UPLOAD_MAX_BYTES) throw tooLargeError(filename);
  const form = new FormData();
  form.append('file', { uri: encryptedFileUri, name: 'a.bin', type: 'application/octet-stream' } as unknown as Blob);
  return await uploadFormToSwarmy(form, filename);
}
