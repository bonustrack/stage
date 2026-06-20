/** @file XMTP remote-attachment send/resolve helpers for the app's XMTP client lib (extracted from lib/xmtp.ts); swarm gateway plumbing and file materialisation live in xmtp.swarm.ts, with encryption/upload behavior byte-identical. */

import { File, Paths } from 'expo-file-system';
import {
  MultiRemoteAttachmentCodec,
  type MultiRemoteAttachmentContent, type RemoteAttachmentInfo,
  type RemoteAttachmentMetadata, type EncryptedLocalAttachment,
} from '@xmtp/react-native-sdk';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { type LocalAttachmentInput } from './xmtp.types';
import {
  EXT_MIME, materializeFileUri, sanitizeFileUri, uploadEncryptedToIpfs, swarmToHttp,
  type SanitizedFileUri,
} from './xmtp.swarm';

export { swarmToHttp } from './xmtp.swarm';

/** Compile-time chokepoint for the metadata strip: the only send-path caller of native `encryptAttachment`, whose `fileUri` param is the branded `SanitizedFileUri` so a file can't be encrypted without passing the strip gate (purely a type fence, runtime-identical). */
interface AttachmentEncryptor {
  encryptAttachment: (file: {
    fileUri: string; mimeType?: string; filename?: string;
  }) => Promise<EncryptedLocalAttachment>;
}
/** Type-fenced wrapper over `client.encryptAttachment` requiring a sanitized file URI. */
export async function encryptSanitizedAttachment(
  client: AttachmentEncryptor,
  file: { fileUri: SanitizedFileUri; mimeType?: string; filename?: string },
): Promise<EncryptedLocalAttachment> {
  return await client.encryptAttachment(file);
}

/** Sends several attachments as one XMTP multi-remote-attachment message: each file is encrypted on-device, its ciphertext uploaded to IPFS, and the URL + decryption metadata bundled into one payload (no inline size cap), returning the message id. */
export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');

  const infos: RemoteAttachmentInfo[] = [];
  for (const f of files) {
    /** Native `encryptAttachment` hard-requires a `file://` uri, but picker results vary (content://, blob:), so anything non-file is materialised into the cache dir first (the old string-prefix hack produced `file://content://x` and never sent). */
    const fileUri = await materializeFileUri(f.fileUri);
    /** Never hand the native encoder an empty MIME — guarantee one from the filename extension as a last resort (matches the composer's `mimeOf`). */
    const mimeType = f.mimeType?.includes('/')
      ? f.mimeType
      : (EXT_MIME[f.filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');
    /** Force-strips embedded metadata (EXIF/GPS/XMP/ICC) from images before encryption so the recipient never gets the sender's location/device fingerprint; non-image formats pass through unchanged. */
    const cleanUri = await sanitizeFileUri(fileUri, mimeType, f.filename);
    /** Encrypt through the branded boundary: `cleanUri` is a `SanitizedFileUri`, the only type `encryptSanitizedAttachment` accepts. Threading a raw `string` here would not compile. */
    const encrypted = await encryptSanitizedAttachment(client, {
      fileUri: cleanUri, mimeType, filename: f.filename,
    });
    const url = await uploadEncryptedToIpfs(encrypted.encryptedLocalFileUri, f.filename);
    /** `buildMultiRemoteAttachmentInfo` stitches the upload URL onto the encryption metadata (secret/salt/nonce/digest) the recipient needs to decrypt. */
    infos.push(MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, encrypted.metadata));
  }

  const payload: MultiRemoteAttachmentContent = { attachments: infos };
  return await conv.send({ multiRemoteAttachment: payload });
}

/** Downloads and decrypts a single remote attachment to a local `file://` URI the RN player can render: ciphertext is fetched from its IPFS URL, written to cache, then passed to native `decryptAttachment` with the message metadata. */
export async function resolveRemoteAttachment(info: RemoteAttachmentInfo): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  /** Unique cache filename so concurrent resolves don't collide. */
  const tmpName = `xmtp-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  /** The stored url may be gateway-agnostic (`swarm://<ref>`) or a legacy full URL; map it to a concrete HTTPS gateway before the GET, since the host doesn't affect decryption (secret/salt/nonce come from message metadata). */
  await File.downloadFileAsync(swarmToHttp(info.url), dest, { idempotent: true });
  const metadata: RemoteAttachmentMetadata = {
    secret: info.secret, salt: info.salt, nonce: info.nonce,
    contentDigest: info.contentDigest, contentLength: info.contentLength,
    filename: info.filename,
  };
  const encrypted: EncryptedLocalAttachment = {
    encryptedLocalFileUri: dest.uri.startsWith('file://') ? dest.uri : `file://${dest.uri.replace(/^file:\/+/, '/')}`,
    metadata,
  };
  const decrypted = await client.decryptAttachment(encrypted);
  return { fileUri: decrypted.fileUri, mimeType: decrypted.mimeType, filename: decrypted.filename };
}

/** Read a local file URI into a base64 string. Used to wrap picker results in the shape `xmtpSendAttachment` expects. */
export async function fileUriToBase64(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      const result = reader.result;
      if (typeof result !== 'string') { reject(new Error('FileReader returned non-string')); return; }
      /** `data:<mime>;base64,<payload>` — strip the prefix. */
      const comma = result.indexOf(',');
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = (): void => { reject(reader.error ?? new Error('FileReader failed')); };
    reader.readAsDataURL(blob);
  });
}
