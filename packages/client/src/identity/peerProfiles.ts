
import { STAMP_URL } from '../profile/snapshot';

export interface PeerProfile {
  name?: string;
  stale?: boolean;
}

export type PeerProfileEntries = Record<string, string | null>;

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  listeners.forEach(l => { l(); });
}

const STAMP_LOOKUP_CHUNK = 50;

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

function applyNames(chunk: string[], names: Record<string, string>): boolean {
  let changed = false;
  for (const a of chunk) {
    const before = store.get(a);
    if (!before || before.name !== names[a]) changed = true;
    store.set(a, { name: names[a] });
  }
  return changed;
}

async function fetchBatch(addrs: string[]): Promise<void> {
  let changed = false;
  try {
    for (let i = 0; i < addrs.length; i += STAMP_LOOKUP_CHUNK) {
      const chunk = addrs.slice(i, i + STAMP_LOOKUP_CHUNK);
      const names = await lookupNamesChunk(chunk);
      if (names && applyNames(chunk, names)) changed = true;
      chunk.forEach(a => pending.delete(a));
    }
  } finally {
    addrs.forEach(a => pending.delete(a));
    if (changed) notify();
  }
}

function needsLookup(address: string): boolean {
  const entry = store.get(address);
  return (!entry || entry.stale === true) && !pending.has(address);
}

export function ensurePeerProfiles(addresses: (string | null | undefined)[]): void {
  const todo = [
    ...new Set(
      addresses
        .filter((a): a is string => typeof a === 'string' && a.length > 0)
        .map(a => a.toLowerCase()),
    ),
  ].filter(needsLookup);
  if (!todo.length) return;
  todo.forEach(a => pending.add(a));
  void fetchBatch(todo);
}

export function seedPeerProfiles(entries: PeerProfileEntries): void {
  let added = false;
  for (const [address, name] of Object.entries(entries)) {
    const key = address.toLowerCase();
    if (store.has(key)) continue;
    store.set(key, { name: name ?? undefined, stale: true });
    added = true;
  }
  if (added) notify();
}

export function peerProfileEntries(): PeerProfileEntries {
  const out: PeerProfileEntries = {};
  for (const [address, profile] of store) out[address] = profile.name ?? null;
  return out;
}

export function isPeerResolved(address?: string | null): boolean {
  return !!address && store.has(address.toLowerCase());
}

export function getPeerName(address?: string | null): string | undefined {
  if (!address) return undefined;
  const n = store.get(address.toLowerCase())?.name;
  return n?.trim() ? n.trim() : undefined;
}

export function subscribePeerProfiles(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
