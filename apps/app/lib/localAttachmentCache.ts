/** @file Reactive session cache mapping XMTP message ids to locally-sent attachment `file://` URIs so confirmed bubbles paint the on-disk image instantly instead of spinning on the IPFS round trip. */

/** Session-scoped reactive store of local `file://` attachment URIs keyed by REAL XMTP message id; resolvers subscribe so a late `conv.send` write repaints the on-disk file instantly (fixing the spinner gap when the echo bubble mounts before the URI is remembered). Entries drop on app restart. */

import { useSyncExternalStore } from 'react';
import { File, Paths } from 'expo-file-system';

/** messageId → ordered list of local `file://` URIs (one per attachment, in the same order the composer staged them). */
const byMessageId = new Map<string, string[]>();

/** Subscribers notified on every write so already-mounted resolvers re-read. */
const listeners = new Set<() => void>();
/** Emit helper. */
function emit(): void { for (const l of listeners) l(); }

/** Remember the local URIs for a freshly-sent message, keyed by its REAL XMTP message id (the id `conv.send()` resolved with — identical to the stream echo's id). Empty/falsey uris are skipped — only on-disk locals are useful. */
export function rememberLocalAttachments(messageId: string, uris: readonly (string | undefined)[]): void {
  const locals = uris.map(u => u ?? '');
  if (locals.every(u => u === '')) return;
  byMessageId.set(messageId, [...locals]);
  emit();
}

/** Local `file://` URI for the attachment at `index` of `messageId`, if one was cached for a send made this session. */
function getLocalAttachment(messageId: string, index: number): string | undefined {
  const uri = byMessageId.get(messageId)?.[index];
  /** Treat both missing and stored-empty as "no local"; ?? would leak ''. */
  return uri === undefined || uri === '' ? undefined : uri;
}

/** Pick a safe lowercase file extension (<=5 chars) from a source URI, defaulting to 'bin'. */
function safeExtFor(srcUri: string): string {
  const ext = srcUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
  return ext.length > 0 && ext.length <= 5 ? ext : 'bin';
}

/** Normalise an `expo-file-system` URI to a `file://` scheme. */
function asFileUri(uri: string): string {
  return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
}

/** Copy a freshly-picked local `file://` URI into a STABLE app-cache file pinned for the app session so an evicted picker temp can't blank the pending thumbnail; best-effort, returning the original URI on any failure. */
export function stashLocalAttachment(srcUri: string): string {
  if (!srcUri.startsWith('file://')) return srcUri;
  try {
    const name = `metro-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExtFor(srcUri)}`;
    const src = new File(srcUri);
    const dest = new File(Paths.cache, name);
    if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
    src.copy(dest);
    return asFileUri(dest.uri);
  } catch {
    /** Picker temp is still on disk in the common case — fall back to it. */
    return srcUri;
  }
}

/** Reactive read of the cached local URI for `(messageId, index)`, re-rendering when the URI lands so the bubble swaps its spinner for the on-disk file with zero gap; pass `undefined` ids/indexes to opt out. */
export function useLocalAttachment(messageId?: string, index?: number): string | undefined {
  return useSyncExternalStore(
    (cb) => {
      if (messageId === undefined || index === undefined) return () => { /* nothing to unsubscribe */ return; };
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => (messageId !== undefined && index !== undefined ? getLocalAttachment(messageId, index) : undefined),
  );
}
