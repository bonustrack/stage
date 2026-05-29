/** Lazy, batched cache of peer Snapshot profiles (name + avatar) keyed by lower-cased
 *  address. Lets the channels list, conversation header, and message bubbles show a
 *  user's display name (instead of the raw 0x… address) and append a cache-buster
 *  (&cb=hash(avatar)) to their stamp avatar so an updated avatar shows immediately.
 *
 *  One GraphQL round-trip per batch of unseen addresses; resolved values (incl.
 *  "no profile" → {}) are cached for the session so repeated renders are free. */

import { useEffect, useReducer } from 'react';
import { SNAPSHOT_HUB_GRAPHQL, getCacheHash } from '@metro-labs/client/profile/snapshot';

interface PeerProfile { name?: string; avatar?: string }

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

async function fetchBatch(addrs: string[]): Promise<void> {
  const query =
    'query($ids:[String]!){ users(where:{id_in:$ids}){ id name avatar } }';
  try {
    const res = await fetch(SNAPSHOT_HUB_GRAPHQL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query, variables: { ids: addrs } }),
    });
    const json = await res.json();
    const users: { id: string; name?: string | null; avatar?: string | null }[] =
      json?.data?.users ?? [];
    const seen = new Set<string>();
    for (const u of users) {
      const id = (u.id ?? '').toLowerCase();
      store.set(id, { name: u.name ?? undefined, avatar: u.avatar ?? undefined });
      seen.add(id);
    }
    /** Cache misses as empty so we don't refetch them every render. */
    for (const a of addrs) if (!seen.has(a)) store.set(a, {});
  } catch {
    /* leave unresolved — a later ensure() retries */
  } finally {
    addrs.forEach(a => pending.delete(a));
    listeners.forEach(l => l());
  }
}

/** Overwrite a single peer's cached profile + notify subscribers. Used after
 *  the local user edits their own Snapshot profile (name/avatar) so every
 *  surface reading from this cache — message bubbles, group member rows, the
 *  conversation topnav — picks up the change (incl. a fresh avatar cache-buster)
 *  without an app reload. `null` fields clear that part of the profile. */
export function setPeerProfile(
  address: string,
  profile: { name?: string | null; avatar?: string | null },
): void {
  const id = address.toLowerCase();
  store.set(id, { name: profile.name ?? undefined, avatar: profile.avatar ?? undefined });
  pending.delete(id);
  listeners.forEach(l => l());
}

/** Queue any not-yet-known addresses for a batched fetch. Safe to call often. */
export function ensurePeerProfiles(addresses: (string | null | undefined)[]): void {
  const todo = [...new Set(
    addresses.filter(Boolean).map(a => (a as string).toLowerCase()),
  )].filter(a => !store.has(a) && !pending.has(a));
  if (!todo.length) return;
  todo.forEach(a => pending.add(a));
  void fetchBatch(todo);
}

/** True once we've fetched this address's profile (hit or miss). Lets callers
 *  hold off rendering an avatar until its final URL is known — avoids showing a
 *  cache-buster-less stamp first and swapping it when the profile lands. */
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

/** The raw stored avatar value (ipfs://… or URL), or undefined if the peer has
 *  no custom avatar set. Use to decide whether to show a real avatar at all. */
export function getPeerAvatar(address?: string | null): string | undefined {
  if (!address) return undefined;
  const a = store.get(address.toLowerCase())?.avatar;
  return a && a.trim() ? a : undefined;
}

/** Subscribe + fetch: re-renders the caller when the batch resolves. Returns a
 *  version counter usable as FlatList `extraData` so rows re-render too. */
export function usePeerProfiles(addresses: (string | null | undefined)[]): number {
  const [version, bump] = useReducer((x: number) => x + 1, 0);
  const key = addresses.filter(Boolean).join(',');
  useEffect(() => {
    ensurePeerProfiles(addresses);
    const fn = (): void => bump();
    listeners.add(fn);
    return () => { listeners.delete(fn); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return version;
}
