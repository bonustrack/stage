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
import { lookupAddress } from './stageUsernames';
import { fullName } from './username';

export interface PeerProfile {
  name?: string;
}

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

/** Optional Stage-username gateway base URL. When set, batches also reverse-look
 *  up each address's claimed `<name>.stage.box` and PREFER it over the ENS name
 *  from stamp.fyi. Hosts wire this once at boot via {@link configureStageUsernames};
 *  unset ⇒ behaviour is byte-identical to ENS-only resolution. */
let stageGatewayUrl: string | undefined;

/** Point peer-profile resolution at the Stage username gateway. Call once. */
export function configureStageUsernames(gatewayUrl: string | undefined): void {
  stageGatewayUrl = gatewayUrl && gatewayUrl.trim() ? gatewayUrl.trim() : undefined;
}

function notify(): void {
  listeners.forEach(l => l());
}

/** stamp.fyi `lookup_addresses` rejects (HTTP 500) when asked for more than ~50
 *  addresses at once, so we split every request into chunks below that cap. */
const STAMP_LOOKUP_CHUNK = 50;

/** Resolve display names for ONE chunk (<= STAMP_LOOKUP_CHUNK addrs) from
 *  stamp.fyi (`lookup_addresses` → ENS), the same source Snapshot's own UI
 *  uses. Returns a lower-cased `{ address → name }` map; addresses with no ENS
 *  are simply absent. Returns `null` (NOT `{}`) on a failed request so the
 *  caller can leave those addresses unresolved and retry, rather than caching a
 *  false "no name" that would hide a real ENS forever. */
async function lookupNamesChunk(addrs: string[]): Promise<Record<string, string> | null> {
  try {
    const res = await fetch(STAMP_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ method: 'lookup_addresses', params: addrs }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result: Record<string, string> = json?.result ?? {};
    const out: Record<string, string> = {};
    for (const [addr, name] of Object.entries(result)) {
      if (name && name.trim()) out[addr.toLowerCase()] = name.trim();
    }
    return out;
  } catch {
    return null;
  }
}

/** Reverse-lookup each address's claimed Stage username (if any) against the
 *  configured gateway. Returns a lower-cased `{ address → "<name>.stage.box" }`
 *  map; absent ⇒ no claim (or no gateway / request failed). Never throws. */
async function resolveStageNames(addrs: string[]): Promise<Record<string, string>> {
  if (!stageGatewayUrl) return {};
  const out: Record<string, string> = {};
  await Promise.all(addrs.map(async a => {
    try {
      const rec = await lookupAddress(stageGatewayUrl!, a);
      if (rec) out[a] = fullName(rec.name);
    } catch { /* fall through to ENS */ }
  }));
  return out;
}

async function fetchBatch(addrs: string[]): Promise<void> {
  try {
    for (let i = 0; i < addrs.length; i += STAMP_LOOKUP_CHUNK) {
      const chunk = addrs.slice(i, i + STAMP_LOOKUP_CHUNK);
      const names = await lookupNamesChunk(chunk);
      if (!names) {
        /* This chunk failed — drop it from `pending` so a later ensure() can
         * retry; do NOT cache a miss (that would hide real ENS names). */
        chunk.forEach(a => pending.delete(a));
        continue;
      }
      /** Stage usernames take precedence over ENS: if an address has claimed a
       *  `<name>.stage.box`, show that instead of the stamp/ENS name. One reverse
       *  lookup per address, only when a gateway is configured; failures fall
       *  through to the ENS name. */
      const stage = await resolveStageNames(chunk);
      /** Cache an entry for every requested address (name undefined when no
       *  ENS) so each address resolves once; consumers fall back to the
       *  truncated address, and avatars to the stamp identicon. */
      for (const a of chunk) {
        store.set(a, { name: stage[a] ?? names[a] });
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
