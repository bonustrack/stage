/** Remembers the user's most-recently-used composer attachment type so the
 *  composer can surface a quick-access shortcut beside the "+" menu. Device-only,
 *  no cross-device sync. Same AsyncStorage + in-memory-mirror + subscriber
 *  pattern as the other small prefs (scrollPos.ts/pins.ts); no new dependency.
 *
 *  The stored value is the attachment action's label (e.g. "Image", "Camera")
 *  — a stable key the composer maps back to its icon + handler. */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'composer:lastAttachment';

/** In-memory mirror so a synchronous read on mount can answer after the one-time
 *  load, and the quick-access button repaints instantly when a type is picked. */
let current: string | undefined;
let loaded = false;
const listeners = new Set<() => void>();

/** Kick off the one-time load from storage; notify subscribers when it lands. */
export function loadLastAttachment(): void {
  if (loaded) return;
  loaded = true;
  void AsyncStorage.getItem(KEY)
    .then((raw) => { if (raw != null) { current = raw; listeners.forEach((l) => l()); } })
    .catch(() => { /* best-effort */ });
}

/** Synchronous snapshot — undefined until the first pick / load resolves. */
export function getLastAttachment(): string | undefined { return current; }

/** Record a label as last-used and persist it (best-effort). Notifies subscribers. */
export function setLastAttachment(label: string): void {
  if (label === current) return;
  current = label;
  listeners.forEach((l) => l());
  void AsyncStorage.setItem(KEY, label).catch(() => { /* best-effort */ });
}

/** Subscribe to changes (load + picks). Returns an unsubscribe fn. */
export function subscribeLastAttachment(fn: () => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}
