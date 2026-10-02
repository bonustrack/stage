

import { File, Paths } from 'expo-file-system';
import { makeListeners, useStoreValue } from './storeCore';
import { attempt } from './errorPolicy';

const byMessageId = new Map<string, string[]>();

const listeners = makeListeners();
const emit = listeners.notify;

export function rememberLocalAttachments(messageId: string, uris: readonly (string | undefined)[]): void {
  const locals = uris.map(u => u ?? '');
  if (locals.every(u => u === '')) return;
  byMessageId.set(messageId, [...locals]);
  emit();
}

function getLocalAttachment(messageId: string, index: number): string | undefined {
  const uri = byMessageId.get(messageId)?.[index];
  return uri === undefined || uri === '' ? undefined : uri;
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

export function useLocalAttachment(messageId?: string, index?: number): string | undefined {
  const active = messageId !== undefined && index !== undefined;
  return useStoreValue(
    active ? listeners.subscribe : noSubscribe,
    () => (messageId !== undefined && index !== undefined ? getLocalAttachment(messageId, index) : undefined),
  );
}
