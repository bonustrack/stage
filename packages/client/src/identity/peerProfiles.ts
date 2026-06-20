/** @file Framework-agnostic lazy batched cache of peer display names keyed by lower-cased address, resolved read-only and entirely from stamp.fyi (ENS via `lookup_addresses`) with one round-trip per batch of unseen addresses, results cached for the session; the React `usePeerProfiles` hook subscribes via subscribePeerProfiles. */

import { STAMP_URL } from '../profile/snapshot';

export interface PeerProfile {
  name?: string;
}

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

/** Notify helper. */
function notify(): void {
  listeners.forEach(l => { l(); });
}

/** stamp.fyi `lookup_addresses` rejects (HTTP 500) when asked for more than ~50 addresses at once, so we split every request into chunks below that cap. */
const STAMP_LOOKUP_CHUNK = 50;

/** Resolve display names for ONE chunk (<= STAMP_LOOKUP_CHUNK addrs) from stamp.fyi (`lookup_addresses` ENS) into a lower-cased `{ address: name }` map (no-ENS addresses absent); returns `null` (NOT `{}`) on a failed request so the caller can retry rather than cache a false "no name". */
async function lookupNamesChunk(addrs: string[]): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(STAMP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'lookup_addresses', params: addrs }),
    });
    if (!res.ok) return null;
    const json: unknown = await res.json();
    return namesFromResult(json);
  } catch {
    return null;
  }
}

/** Extract a lower-cased `{ address → trimmed name }` map from a stamp.fyi response body, skipping blank/non-string names. */
function namesFromResult(json: unknown): Record<string, string> {
  const result =
    typeof json === 'object' && json !== null && 'result' in json ? json.result : undefined;
  const out: Record<string, string> = {};
  if (typeof result !== 'object' || result === null) return out;
  for (const [addr, name] of Object.entries(result)) {
    if (typeof name === 'string' && name.trim()) out[addr.toLowerCase()] = name.trim();
  }
  return out;
}

/** Get the Batch. */
async function fetchBatch(addrs: string[]): Promise<void> {
  try {
    for (let i = 0; i < addrs.length; i += STAMP_LOOKUP_CHUNK) {
      const chunk = addrs.slice(i, i + STAMP_LOOKUP_CHUNK);
      const names = await lookupNamesChunk(chunk);
      if (!names) {
        /** This chunk failed — drop it from `pending` so a later ensure() can retry; do NOT cache a miss (that would hide real ENS names). */
        chunk.forEach(a => pending.delete(a));
        continue;
      }
      /** Cache an entry for every requested address (name undefined when no ENS) so each address resolves once; consumers fall back to the truncated address, and avatars to the stamp identicon. */
      for (const a of chunk) {
        store.set(a, { name: names[a] });
        pending.delete(a);
      }
    }
  } finally {
    addrs.forEach(a => pending.delete(a));
    notify();
  }
}

/** Queue any not-yet-known addresses for a batched fetch. Safe to call often. */
export function ensurePeerProfiles(addresses: (string | null | undefined)[]): void {
  const todo = [
    ...new Set(
      addresses
        .filter((a): a is string => typeof a === 'string' && a.length > 0)
        .map(a => a.toLowerCase()),
    ),
  ].filter(a => !store.has(a) && !pending.has(a));
  if (!todo.length) return;
  todo.forEach(a => pending.add(a));
  void fetchBatch(todo);
}

/** True once we've fetched this address's profile (hit or miss). Lets callers hold off rendering an avatar until its final URL is known. */
export function isPeerResolved(address?: string | null): boolean {
  return !!address && store.has(address.toLowerCase());
}

/** Return the cached ENS display name for an address, or undefined when none. */
export function getPeerName(address?: string | null): string | undefined {
  if (!address) return undefined;
  const n = store.get(address.toLowerCase())?.name;
  return n?.trim() ? n.trim() : undefined;
}

/** Subscribe to cache changes. Returns an unsubscribe fn. The host's React hook wraps this to re-render on resolution. */
export function subscribePeerProfiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
