import type { UploadedAttachment } from './xmtp.types';

export function uploadedAttachmentKey(attachment: UploadedAttachment): string {
  return JSON.stringify([attachment.url, attachment.contentDigest]);
}

export interface LocalAttachmentPreview { uri: string; mime?: string }

export function makeLocalAttachmentCache() {
  const byMessageId = new Map<string, readonly LocalAttachmentPreview[]>();
  const byUpload = new Map<string, LocalAttachmentPreview>();
  let uploadedByLocalId = new Map<string, readonly string[]>();

  return {
    remember(messageId: string, previews: readonly LocalAttachmentPreview[], uploaded?: readonly UploadedAttachment[]): boolean {
      const locals = previews.map(({ uri, mime }) => ({ uri, mime }));
      if (locals.every(local => local.uri === '')) return false;
      byMessageId.set(messageId, locals);
      if (uploaded) {
        const keys = uploaded.map(uploadedAttachmentKey);
        uploadedByLocalId = new Map(uploadedByLocalId).set(messageId, keys);
        keys.forEach((key, i) => {
          const local = locals[i];
          if (local?.uri) byUpload.set(key, local);
        });
      }
      return true;
    },
    get(messageId: string, index: number, uploaded?: UploadedAttachment): LocalAttachmentPreview | undefined {
      const local = byMessageId.get(messageId)?.[index];
      if (local?.uri) return local;
      return uploaded ? byUpload.get(uploadedAttachmentKey(uploaded)) : undefined;
    },
    uploaded: (): ReadonlyMap<string, readonly string[]> => uploadedByLocalId,
  };
}
