/** Device-local custom avatar override for the logged-in user.
 *
 *  XMTP has NO native user profile: `InboxState` carries only inboxId /
 *  identities / installations - no display name or avatar. So a custom avatar
 *  that OTHER users would see needs our own registry (a Snapshot/ENS-style
 *  profile record or a published content type) - out of scope here. This store
 *  ships the LOCAL part only: the user picks an image (uploaded via the existing
 *  pineapple IPFS helper) and we render it for THEIR OWN avatar on this device.
 *  Peers still see the stamp.fyi identicon - that is the documented limitation.
 *
 *  Stored as the override URI string (ipfs:// or https://), '' = no override
 *  (fall back to stamp.fyi). Built on the shared lib/persistedStore.ts value
 *  store so the in-memory mirror lets `getSelfAvatarSync` read synchronously and
 *  the pub/sub repaints every self-avatar call site the instant it changes. */

import { createValueStore } from './persistedStore';

const store = createValueStore<string>({
  key: 'profile.selfAvatar',
  default: '',
  deserialize: (raw) => raw,
  alwaysNotify: true,
});

/** Read the persisted override once and cache it. '' = no override. */
export const loadSelfAvatar = (): Promise<string> => store.load();

/** Fire-and-forget the one-time load; notifies subscribers when it lands. */
export const loadSelfAvatarAsync = (): void => store.loadAsync();

/** Synchronous read from the in-memory cache. '' until loaded / when unset. */
export const getSelfAvatarSync = (): string => store.get();

/** Persist a new override URI ('' to clear), update the cache, and notify. */
export const setSelfAvatar = (uri: string): Promise<void> => store.setAsync(uri);

/** Subscribe to override changes. Returns an unsubscribe fn. */
export const subscribeSelfAvatar = (cb: () => void): () => void => store.subscribe(cb);
