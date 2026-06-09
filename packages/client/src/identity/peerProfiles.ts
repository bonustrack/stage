/** Lazy, batched cache of peer identities (display name) keyed by lower-cased
 *  address. Lets the channels list, conversation header, and message bubbles
 *  show a user's display name (instead of the raw 0x… address).
 *
 *  Identity is resolved ENTIRELY from stamp.fyi (the same source Snapshot's own
 *  UI uses): names via `lookup_addresses` (ENS) and avatars via the stamp.fyi
 *  identicon endpoint (handled by the Avatar component's address fallback).
 *  There is no in-app profile editing and no Snapshot hub usage — identity is
 *  read-only for the local user and every peer alike.
 *
 *  One stamp round-trip per batch of unseen addresses; resolved values (incl.
 *  "no name" → {}) are cached for the session so repeated renders are free.
 *
 *  This is the framework-agnostic core. The React `usePeerProfiles` hook stays
 *  in apps/app and subscribes via {@link subscribePeerProfiles}. */

import { STAMP_URL } from '../profile/snapshot';

export interface PeerProfile {
  name?: string;
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

/** Subscribe to cache changes. Returns an unsubscribe fn. The host's React hook
 *  wraps this to re-render on resolution. */
export function subscribePeerProfiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
