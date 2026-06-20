
import { STAMP_URL } from '../profile/snapshot';

export interface PeerProfile {
  name?: string;
}

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

async function fetchBatch(addrs: string[]): Promise<void> {
  try {
    for (let i = 0; i < addrs.length; i += STAMP_LOOKUP_CHUNK) {
      const chunk = addrs.slice(i, i + STAMP_LOOKUP_CHUNK);
      const names = await lookupNamesChunk(chunk);
      if (!names) {
        chunk.forEach(a => pending.delete(a));
        continue;
      }
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
