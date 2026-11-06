import { File, Paths } from 'expo-file-system';
import { makeListeners, useStoreValue } from './storeCore';
import { attempt } from './errorPolicy';
import type { UploadedAttachment } from './xmtp.types';
import { makeLocalAttachmentCache, type LocalAttachmentPreview } from './localAttachmentCache.core';
import { randomHex } from '@stage-labs/client/ids';
import { fileExtension, withoutQuery } from '@stage-labs/client/files';

const cache = makeLocalAttachmentCache();

const listeners = makeListeners();
const emit = listeners.notify;

export function rememberLocalAttachments(
  messageId: string,
  previews: readonly LocalAttachmentPreview[],
  uploaded?: readonly UploadedAttachment[],
): void {
  if (cache.remember(messageId, previews, uploaded)) emit();
}

export function useUploadedAttachments(): ReadonlyMap<string, readonly string[]> {
  return useStoreValue(listeners.subscribe, cache.uploaded);
}

function safeExtFor(srcUri: string): string {
  const ext = fileExtension(withoutQuery(srcUri));
  return ext.length > 0 && ext.length <= 5 ? ext : 'bin';
}

export function asFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

export function stashLocalAttachment(srcUri: string): string {
  if (!srcUri.startsWith('file://')) return srcUri;
  try {
    const name = `stage-pending-${Date.now()}-${randomHex(3)}.${safeExtFor(srcUri)}`;
    const src = new File(srcUri);
    const dest = new File(Paths.cache, name);
    if (dest.exists)
      attempt(() => {
        dest.delete();
      }, 'cleanup');
    src.copySync(dest);
    return asFileUri(dest.uri);
  } catch {
    return srcUri;
  }
}

const noSubscribe = (): (() => void) => () => undefined;

export function useLocalAttachment(messageId?: string, index?: number, uploaded?: UploadedAttachment): LocalAttachmentPreview | undefined {
  const active = messageId !== undefined && index !== undefined;
  return useStoreValue(active ? listeners.subscribe : noSubscribe, () =>
    messageId !== undefined && index !== undefined ? cache.get(messageId, index, uploaded) : undefined,
  );
}
