import type { UploadedAttachment } from './xmtp.types';

export function uploadedAttachmentKey(attachment: UploadedAttachment): string {
  return JSON.stringify([attachment.url, attachment.contentDigest]);
}

export function makeLocalAttachmentCache() {
  const byMessageId = new Map<string, readonly string[]>();
  const byUpload = new Map<string, string>();
  let uploadedByLocalId = new Map<string, readonly string[]>();

  return {
    remember(messageId: string, uris: readonly (string | undefined)[], uploaded?: readonly UploadedAttachment[]): boolean {
      const locals = uris.map(uri => uri ?? '');
      if (locals.every(uri => uri === '')) return false;
      byMessageId.set(messageId, locals);
      if (uploaded) {
        const keys = uploaded.map(uploadedAttachmentKey);
        uploadedByLocalId = new Map(uploadedByLocalId).set(messageId, keys);
        keys.forEach((key, i) => {
          const uri = locals[i];
          if (uri) byUpload.set(key, uri);
        });
      }
      return true;
    },
    get(messageId: string, index: number, uploaded?: UploadedAttachment): string | undefined {
      const uri = byMessageId.get(messageId)?.[index];
      if (uri) return uri;
      return uploaded ? byUpload.get(uploadedAttachmentKey(uploaded)) : undefined;
    },
    uploaded: (): ReadonlyMap<string, readonly string[]> => uploadedByLocalId,
  };
}
