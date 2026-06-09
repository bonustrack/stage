/** Lazy, batched cache of peer identities (name + avatar) keyed by lower-cased
 *  address. Lets the channels list, conversation header, and message bubbles
 *  show a user's display name (instead of the raw 0x… address) and a cache-buster
 *  (&cb=hash(avatar)) on their stamp avatar so an updated avatar shows immediately.
 *
 *  Identity is resolved ENTIRELY from stamp.fyi (the same source Snapshot's own
 *  UI uses): names via `lookup_addresses` (ENS) and avatars via the stamp.fyi
 *  identicon endpoint (handled by the Avatar component's address fallback). The
 *  Snapshot hub GraphQL is NOT used here. A peer's `avatar` is only ever set by
 *  the local optimistic update after the signed-in user edits their own profile
 *  (see setPeerProfile); for everyone else it stays undefined and the renderer
 *  falls back to the stamp identicon.
 *
 *  One stamp round-trip per batch of unseen addresses; resolved values (incl.
 *  "no name" → {}) are cached for the session so repeated renders are free.
 *
 *  This is the framework-agnostic core. The React `usePeerProfiles` hook stays
 *  in apps/app and subscribes via {@link subscribePeerProfiles}. */

import { STAMP_URL, getCacheHash } from '../profile/snapshot';

export interface PeerProfile {
  name?: string;
  avatar?: string;
}

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(l => l());
}

/** Resolve display names from stamp.fyi (`lookup_addresses` → ENS), the same
 *  source Snapshot's own UI uses. Returns a lower-cased `{ address → name }`
 *  map; addresses with no ENS are simply absent. */
async function lookupNames(addrs: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetch(STAMP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'lookup_addresses', params: addrs }),
    });
    const json = await res.json();
    const result: Record<string, string> = json?.result ?? {};
    const out: Record<string, string> = {};
    for (const [addr, name] of Object.entries(result)) {
      if (name && name.trim()) out[addr.toLowerCase()] = name.trim();
    }
    return out;
  } catch {
    return {};
  }
}

async function fetchBatch(addrs: string[]): Promise<void> {
  try {
    const names = await lookupNames(addrs);
    /** Cache an entry for every requested address (empty {} when no ENS) so each
     *  address resolves once; avatars come from the stamp identicon fallback. */
    for (const a of addrs) {
      store.set(a, { name: names[a] });
    }
  } catch {
    /* leave unresolved — a later ensure() retries */
  } finally {
    addrs.forEach(a => pending.delete(a));
    notify();
  }
}

/** Overwrite a single peer's cached profile + notify subscribers. Used after
 *  the local user edits their own Snapshot profile (name/avatar) so every
 *  surface reading from this cache picks up the change (incl. a fresh avatar
 *  cache-buster) without an app reload. `null` fields clear that part. */
export function setPeerProfile(
  address: string,
  profile: { name?: string | null; avatar?: string | null },
): void {
  const id = address.toLowerCase();
  store.set(id, { name: profile.name ?? undefined, avatar: profile.avatar ?? undefined });
  pending.delete(id);
  notify();
}

/** Queue any not-yet-known addresses for a batched fetch. Safe to call often. */
export function ensurePeerProfiles(addresses: (string | null | undefined)[]): void {
  const todo = [
    ...new Set(addresses.filter(Boolean).map(a => (a as string).toLowerCase())),
  ].filter(a => !store.has(a) && !pending.has(a));
  if (!todo.length) return;
  todo.forEach(a => pending.add(a));
  void fetchBatch(todo);
}

/** True once we've fetched this address's profile (hit or miss). Lets callers
 *  hold off rendering an avatar until its final URL is known. */
export function isPeerResolved(address?: string | null): boolean {
  return !!address && store.has(address.toLowerCase());
}

export function getPeerName(address?: string | null): string | undefined {
  if (!address) return undefined;
  const n = store.get(address.toLowerCase())?.name;
  return n && n.trim() ? n.trim() : undefined;
}

export function getPeerAvatarCb(address?: string | null): string | undefined {
  if (!address) return undefined;
  return getCacheHash(store.get(address.toLowerCase())?.avatar);
}

/** The raw stored avatar value (ipfs://… or URL), or undefined if unset. Only
 *  set for the local user's own address; peers fall back to the stamp identicon. */
export function getPeerAvatar(address?: string | null): string | undefined {
  if (!address) return undefined;
  const a = store.get(address.toLowerCase())?.avatar;
  return a && a.trim() ? a : undefined;
}

/** Subscribe to cache changes. Returns an unsubscribe fn. The host's React hook
 *  wraps this to re-render on resolution. */
export function subscribePeerProfiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
