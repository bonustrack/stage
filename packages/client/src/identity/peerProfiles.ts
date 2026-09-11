
import { STAMP_URL } from '../profile/snapshot';
import type { OnchainProfile, OnchainProfileSource } from './onchainProfile';

export interface PeerProfile {
  name?: string;
  avatar?: string;
  source?: OnchainProfileSource;
  stale?: boolean;
}

export interface PersistedPeerProfile { name: string | null; avatar?: string; source?: OnchainProfileSource }

export type PeerProfileEntries = Record<string, string | null | PersistedPeerProfile>;

export type OnchainProfileResolver = (address: string) => Promise<OnchainProfile | null>;

const store = new Map<string, PeerProfile>();
const pending = new Set<string>();
const listeners = new Set<() => void>();
let onchainResolver: OnchainProfileResolver | null = null;
const ONCHAIN_CONCURRENCY = 4;

export function setOnchainProfileResolver(resolver: OnchainProfileResolver | null): void {
  onchainResolver = resolver;
}

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
    store.set(a, { name: names[a], avatar: before?.avatar, source: before?.source });
  }
  return changed;
}

function applyOnchain(address: string, profile: OnchainProfile | null): boolean {
  if (!profile) return false;
  const before = store.get(address);
  if (before?.name === profile.name && before.avatar === profile.avatar && before.source === profile.source) return false;
  store.set(address, { name: profile.name, avatar: profile.avatar, source: profile.source });
  return true;
}

async function resolveOnchainBatch(addrs: string[]): Promise<void> {
  const resolver = onchainResolver;
  if (!resolver) return;
  const queue = [...addrs];
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const profile = await resolver(next).catch(() => null);
      if (applyOnchain(next, profile)) notify();
    }
  };
  await Promise.all(Array.from({ length: Math.min(ONCHAIN_CONCURRENCY, queue.length) }, worker));
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
  void resolveOnchainBatch(addrs);
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
  for (const [address, entry] of Object.entries(entries)) {
    const key = address.toLowerCase();
    if (store.has(key)) continue;
    const persisted = typeof entry === 'object' && entry !== null ? entry : { name: entry };
    store.set(key, { name: persisted.name ?? undefined, avatar: persisted.avatar, source: persisted.source, stale: true });
    added = true;
  }
  if (added) notify();
}

export function peerProfileEntries(): PeerProfileEntries {
  const out: PeerProfileEntries = {};
  for (const [address, profile] of store) {
    out[address] = profile.avatar === undefined && profile.source === undefined
      ? profile.name ?? null
      : { name: profile.name ?? null, avatar: profile.avatar, source: profile.source };
  }
  return out;
}

export function getPeerAvatar(address?: string | null): string | undefined {
  if (!address) return undefined;
  return store.get(address.toLowerCase())?.avatar;
}

export function getPeerProfileSource(address?: string | null): OnchainProfileSource | undefined {
  if (!address) return undefined;
  return store.get(address.toLowerCase())?.source;
}

export function invalidatePeerProfile(address: string): void {
  const key = address.toLowerCase();
  const entry = store.get(key);
  if (entry) store.set(key, { ...entry, stale: true });
  ensurePeerProfiles([key]);
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
