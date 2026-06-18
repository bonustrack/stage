/** XMTP remote-attachment send / resolve helpers for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split); re-exported from there. Swarm
 *  gateway plumbing + file materialisation live in xmtp.swarm.ts. KEEP all
 *  encryption/upload behavior byte-identical. */

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

/** Compile-time chokepoint for the metadata strip. This is the ONLY function in
 *  the send path that calls the native `encryptAttachment`, and its `fileUri`
 *  param is typed `SanitizedFileUri` (a branded string only `sanitizeFileUri`
 *  can produce). So you physically cannot encrypt a file that has not been
 *  through the strip gate without a deliberate, reviewable `as SanitizedFileUri`
 *  cast. Behaviour is identical to calling `client.encryptAttachment` directly -
 *  this wrapper is purely a type fence. */
type AttachmentEncryptor = {
  encryptAttachment: (file: {
    fileUri: string; mimeType?: string; filename?: string;
  }) => Promise<EncryptedLocalAttachment>;
};
/** Type-fenced wrapper over `client.encryptAttachment` requiring a sanitized file URI. */
export async function encryptSanitizedAttachment(
  client: AttachmentEncryptor,
  file: { fileUri: SanitizedFileUri; mimeType?: string; filename?: string },
): Promise<EncryptedLocalAttachment> {
  return await client.encryptAttachment(file);
}

/** Send several attachments as ONE XMTP message using the multi-remote-attachment
 *  content type. Each file is encrypted on-device (native `encryptAttachment`),
 *  its ciphertext uploaded to IPFS, and the resulting URL + decryption metadata
 *  bundled into a single `multiRemoteAttachment` payload. This replaces the old
 *  "one inline StaticAttachment message per file" loop — recipients now get a
 *  single message + there's no ~800 KB inline cap (the bytes ride IPFS, not the
 *  MLS envelope). Returns the message id. */
export async function xmtpSendMultiRemoteAttachment(
  line: string, files: LocalAttachmentInput[],
): Promise<string> {
  if (files.length === 0) throw new Error('No attachments to send.');
  const conv = await convOfLine(line);
  if (!conv) throw new Error(`XMTP conversation not found: ${line}`);
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');

  const infos: RemoteAttachmentInfo[] = [];
  for (const f of files) {
    /** Native `encryptAttachment` hard-requires a `file://` uri. Picker results
     *  vary by platform/source:
     *   - voice recorder / expo-image-picker copies → already `file://…`
     *   - Android gallery (`MediaLibrary` fallback when ACCESS_MEDIA_LOCATION is
     *     denied) → `content://…`
     *   - web → `blob:…`
     *  Anything that isn't `file://` is materialised into the cache dir first.
     *  The previous `file://${…}` string-prefix hack turned `content://x` into
     *  `file://content://x`, which the native side rejected — gallery images on
     *  Android never sent. */
    const fileUri = await materializeFileUri(f.fileUri);
    /** Never hand the native encoder an empty MIME — guarantee one from the
     *  filename extension as a last resort (matches the composer's `mimeOf`). */
    const mimeType = f.mimeType && f.mimeType.includes('/')
      ? f.mimeType
      : (EXT_MIME[f.filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream');
    /** Force-strip embedded metadata (EXIF/GPS/XMP/ICC/timestamps) from images
     *  BEFORE encryption so the recipient never receives a photo carrying the
     *  sender's location or device fingerprint. Non-image / unsupported formats
     *  pass through unchanged (see sanitizeFileUri). */
    const cleanUri = await sanitizeFileUri(fileUri, mimeType, f.filename);
    /** Encrypt through the branded boundary: `cleanUri` is a `SanitizedFileUri`,
     *  the only type `encryptSanitizedAttachment` accepts. Threading a raw
     *  `string` here would not compile. */
    const encrypted = await encryptSanitizedAttachment(client, {
      fileUri: cleanUri, mimeType, filename: f.filename,
    });
    const url = await uploadEncryptedToIpfs(encrypted.encryptedLocalFileUri, f.filename);
    /** `buildMultiRemoteAttachmentInfo` stitches the upload URL onto the encryption
     *  metadata (secret/salt/nonce/digest) the recipient needs to decrypt. */
    infos.push(MultiRemoteAttachmentCodec.buildMultiRemoteAttachmentInfo(url, encrypted.metadata));
  }

  const payload: MultiRemoteAttachmentContent = { attachments: infos };
  return await conv.send({ multiRemoteAttachment: payload });
}

/** Download + decrypt a single remote attachment to a local `file://` URI the RN
 *  `Image`/audio player can render. Used by the bubble renderer when it hits a
 *  `remote` attachment placeholder. The ciphertext is fetched from its IPFS URL,
 *  written to the cache dir, then handed to the native `decryptAttachment` with
 *  the metadata that travelled in the message. */
export async function resolveRemoteAttachment(info: RemoteAttachmentInfo): Promise<{
  fileUri: string; mimeType?: string; filename?: string;
}> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  /** Unique cache filename so concurrent resolves don't collide. */
  const tmpName = `xmtp-att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.bin`;
  const dest = new File(Paths.cache, tmpName);
  if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
  /** The stored url may be gateway-agnostic (`swarm://<ref>`) or a legacy full
   *  gateway URL. Map it to a concrete HTTPS gateway before the GET — the native
   *  decrypt only sees ciphertext bytes, so the host doesn't affect decryption
   *  (secret/salt/nonce come from the message metadata, untouched here). */
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

/** Read a local file URI into a base64 string. Used to wrap picker results in the
 *  shape `xmtpSendAttachment` expects. */
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
    reader.onerror = (): void => reject(reader.error ?? new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}
