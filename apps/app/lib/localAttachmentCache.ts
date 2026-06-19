/** @file Reactive session cache mapping XMTP message ids to locally-sent attachment `file://` URIs so confirmed bubbles paint the on-disk image instantly instead of spinning on the IPFS round trip. */

/*
 * Session-scoped cache of the LOCAL `file://` URIs for attachments the user just
 *  sent, keyed by the REAL XMTP message id. Bridges the optimistic→confirmed
 *  handoff for image (and other) attachments:
 *
 *   - The optimistic bubble renders the local picker URI instantly (shows at once).
 *   - On confirm, that bubble is dropped and replaced by the LIVE message, whose
 *     attachment is a `multiRemoteAttachment` placeholder — its bytes still have to
 *     be downloaded + decrypted from IPFS (`RemoteAttachmentResolver`). That round
 *     trip left a blank/spinner gap for a few seconds → the image "disappeared"
 *     then "reappeared".
 *
 *  THE TIMING BUG this version fixes: `conv.send({ multiRemoteAttachment })`
 *  encrypts + uploads to IPFS before its JS promise resolves, but the MLS message
 *  commits (and can stream-echo into the live feed) BEFORE that promise returns.
 *  So the echo bubble's `RemoteAttachmentResolver` frequently MOUNTED before
 *  `rememberLocalAttachments(realId, …)` ran. The previous design only read the
 *  cache in `useState(initial)`, so a late write was never observed → the bubble
 *  sat on a spinner until the IPFS download finished (the persistent gap).
 *
 *  Fix: make the cache a tiny reactive store. The resolver subscribes; the moment
 *  the local URI lands under its message id (whenever `conv.send` resolves), it
 *  re-reads and paints the already-on-disk local file instantly — no blank, no
 *  spinner — while the remote download finishes in the background.
 *
 *  The cache holds plain `file://` cache-dir URIs (already materialised by the
 *  picker / send path), so it costs nothing to keep for the app session; entries
 *  are dropped on app restart.
 */

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
  // Treat both missing and stored-empty as "no local"; ?? would leak ''.
  return uri === undefined || uri === '' ? undefined : uri;
}

/**
 * Copy a freshly-picked local `file://` URI into a STABLE app-cache file so it
 *  survives the entire pending window. The OS image/document picker hands back a
 *  temp URI (e.g. an `ImagePicker` cache entry) that can be evicted while the
 *  send is in flight — if that happens mid-pending the dimmed thumbnail blanks.
 *  Copying to our own `Paths.cache` entry pins the bytes for the app session.
 *
 *  Best-effort + synchronous-friendly: on any failure (non-`file://` scheme,
 *  copy error) it returns the original URI so the caller is never worse off. The
 *  copy is cheap (already-on-disk bytes) and the dest lives until app restart.
 */
// eslint-disable-next-line complexity -- TODO(chaitu): refactor (complexity 12)
export function stashLocalAttachment(srcUri: string): string {
  if (!srcUri.startsWith('file://')) return srcUri;
  try {
    const ext = srcUri.split('?')[0]?.split('#')[0]?.split('.').pop()?.toLowerCase() ?? 'bin';
    const safeExt = ext.length > 0 && ext.length <= 5 ? ext : 'bin';
    const name = `metro-pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;
    const src = new File(srcUri);
    const dest = new File(Paths.cache, name);
    if (dest.exists) try { dest.delete(); } catch { /* overwrite below */ }
    src.copy(dest);
    const uri = dest.uri;
    return uri.startsWith('file://') ? uri : `file://${uri.replace(/^file:\/+/, '/')}`;
  } catch {
    /** Picker temp is still on disk in the common case — fall back to it. */
    return srcUri;
  }
}

/**
 * Reactive read of the cached local URI for `(messageId, index)`. Re-renders the
 *  caller when the URI lands (e.g. `conv.send()` resolves AFTER the echo bubble
 *  mounted) so the bubble swaps its spinner for the on-disk local file with zero
 *  gap. Pass `undefined` ids/indexes to opt out (returns undefined, no subscribe
 *  churn).
 */
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
