

import { File, Paths } from 'expo-file-system';
import { makeListeners, useStoreValue } from './storeCore';
import { attempt } from './errorPolicy';
import type { UploadedAttachment } from './xmtp.types';
import { makeLocalAttachmentCache } from './localAttachmentCache.core';

const cache = makeLocalAttachmentCache();

const listeners = makeListeners();
const emit = listeners.notify;

export function rememberLocalAttachments(
  messageId: string, uris: readonly (string | undefined)[], uploaded?: readonly UploadedAttachment[],
): void {
  if (cache.remember(messageId, uris, uploaded)) emit();
}

export function useUploadedAttachments(): ReadonlyMap<string, readonly string[]> {
  return useStoreValue(listeners.subscribe, cache.uploaded);
}

function safeExtFor(srcUri: string): string {
  const ext = srcUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  return ext.length > 0 && ext.length <= 5 ? ext : 'bin';
}

export function asFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

export function stashLocalAttachment(srcUri: string): string {
  if (!srcUri.startsWith('file://')) return srcUri;
  try {
    const name = `stage-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtFor(srcUri)}`;
    const src = new File(srcUri);
    const dest = new File(Paths.cache, name);
    if (dest.exists) attempt(() => { dest.delete(); }, 'cleanup');
    src.copySync(dest);
    return asFileUri(dest.uri);
  } catch {
    return srcUri;
  }
}

const noSubscribe = (): (() => void) => () => undefined;

export function useLocalAttachment(messageId?: string, index?: number, uploaded?: UploadedAttachment): string | undefined {
  const active = messageId !== undefined && index !== undefined;
  return useStoreValue(
    active ? listeners.subscribe : noSubscribe,
    () => (messageId !== undefined && index !== undefined ? cache.get(messageId, index, uploaded) : undefined),
  );
}
