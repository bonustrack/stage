

import { useSyncExternalStore } from 'react';
import { File, Paths } from 'expo-file-system';

const byMessageId = new Map<string, string[]>();

const listeners = new Set<() => void>();
function emit(): void { for (const l of listeners) l(); }

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

function asFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

export function stashLocalAttachment(srcUri: string): string {
  if (!srcUri.startsWith('file://')) return srcUri;
  try {
    const name = `metro-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtFor(srcUri)}`;
    const src = new File(srcUri);
    const dest = new File(Paths.cache, name);
    if (dest.exists) try { dest.delete(); } catch { }
    src.copy(dest);
    return asFileUri(dest.uri);
  } catch {
    return srcUri;
  }
}

export function useLocalAttachment(messageId?: string, index?: number): string | undefined {
  return useSyncExternalStore(
    (cb) => {
      if (messageId === undefined || index === undefined) return () => { return; };
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => (messageId !== undefined && index !== undefined ? getLocalAttachment(messageId, index) : undefined),
  );
}
