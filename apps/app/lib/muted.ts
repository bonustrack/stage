/** Local (device-only) muted channels. Persists a set of muted conversation ids
 *  in AsyncStorage so the app can suppress the foreground rich notification for a
 *  muted conv and drop it from the total unread badge. In-memory cache +
 *  dependency-free pub/sub so the channels list, menus, and footer badge repaint
 *  the instant a conv is muted/unmuted.
 *
 *  WHY LOCAL (not XMTP): XMTP RN SDK 5.7.0 exposes NO per-conversation
 *  notification preference - mute is purely an app concern. A daemon-side mute
 *  (so the background FCM fan-out skips muted convs too) would need new
 *  control-DM plumbing; we keep mute device-local and suppress only the
 *  client-presented local notification + the unread badge. Background FCM may
 *  still reach the OS notification tray; a synced/daemon mute is a later step.
 *
 *  Built on the shared lib/persistedStore.ts set-store factory (same as the
 *  pins / archived stores). */

import { createSetStore } from './persistedStore';

const store = createSetStore('channels.muted');

/** Read the persisted set once and cache it. Subsequent calls return the cached
 *  set without touching storage. */
export const loadMutedIds = (): Promise<Set<string>> => store.load();

/** Synchronous membership check from the in-memory cache. Returns false until
 *  `loadMutedIds` has run. */
export const isMuted = (convId: string): boolean => store.has(convId);

/** Flip a conv's muted membership, persist, update the cache, notify
 *  subscribers, and return the new set. */
export const toggleMuted = (convId: string): Promise<Set<string>> => store.toggle(convId);

/** Subscribe to mute changes. Returns an unsubscribe fn. */
export const subscribeMuted = (cb: () => void): () => void => store.subscribe(cb);
