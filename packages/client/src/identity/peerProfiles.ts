import { shortAddress } from './format';

import { STAMP_URL } from '../profile/avatar';
import type { OnchainProfile, OnchainProfileSource } from './onchainProfile';
import { displayHandle } from './stageNames';

export interface PeerProfile {
  name?: string;
  displayName?: string;
  description?: string;
  avatar?: string;
  source?: OnchainProfileSource;
  stale?: boolean;
}

export interface PersistedPeerProfile {
  name: string | null;
  displayName?: string;
  description?: string;
  avatar?: string;
  source?: OnchainProfileSource;
}

export type PeerProfileEntries = Record<string, string | null | PersistedPeerProfile>;

export type OnchainProfileResolver = (address: string) => Promise<OnchainProfile | null>;

export interface PeerProfilesOptions {
  resolveOnchain?: OnchainProfileResolver;
}

type Lookup<T> = (address?: string | null) => T | undefined;

export interface PeerProfiles {
  ensure: (addresses: (string | null | undefined)[]) => void;
  seed: (entries: PeerProfileEntries) => void;
  entries: () => PeerProfileEntries;
  invalidate: (address: string) => void;
  isResolved: (address?: string | null) => boolean;
  name: Lookup<string>;
  displayName: Lookup<string>;
  handle: Lookup<string>;
  description: Lookup<string>;
  avatar: Lookup<string>;
  source: Lookup<OnchainProfileSource>;
  label: (address: string) => string;
  subscribe: (listener: () => void) => () => void;
}

interface State {
  store: Map<string, PeerProfile>;
  pending: Set<string>;
  listeners: Set<() => void>;
  resolveOnchain: OnchainProfileResolver | undefined;
}

const ONCHAIN_CONCURRENCY = 4;
const STAMP_LOOKUP_CHUNK = 50;

function notify(s: State): void {
  s.listeners.forEach((l) => {
    l();
  });
}

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
  const result = typeof json === 'object' && json !== null && 'result' in json ? json.result : undefined;
  const out: Record<string, string> = {};
  if (typeof result !== 'object' || result === null) return out;
  for (const [addr, name] of Object.entries(result)) {
    if (typeof name === 'string' && name.trim()) out[addr.toLowerCase()] = name.trim();
  }
  return out;
}

function applyNames(s: State, chunk: string[], names: Record<string, string>): boolean {
  let changed = false;
  for (const a of chunk) {
    const before = s.store.get(a);
    if (!before || before.name !== names[a]) changed = true;
    s.store.set(a, { ...before, name: names[a], stale: undefined });
  }
  return changed;
}

function applyOnchain(s: State, address: string, profile: OnchainProfile | null): boolean {
  if (!profile) return false;
  const before = s.store.get(address);
  const next: PeerProfile = {
    name: profile.name,
    displayName: profile.displayName,
    description: profile.description,
    avatar: profile.avatar,
    source: profile.source,
  };
  if (before && (Object.keys(next) as (keyof PeerProfile)[]).every((k) => before[k] === next[k])) return false;
  s.store.set(address, next);
  return true;
}

async function resolveOnchainBatch(s: State, addrs: string[]): Promise<void> {
  const resolver = s.resolveOnchain;
  if (!resolver) return;
  const queue = [...addrs];
  const worker = async (): Promise<void> => {
    for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
      const profile = await resolver(next).catch(() => null);
      if (applyOnchain(s, next, profile)) notify(s);
    }
  };
  await Promise.all(Array.from({ length: Math.min(ONCHAIN_CONCURRENCY, queue.length) }, worker));
}

async function fetchBatch(s: State, addrs: string[]): Promise<void> {
  let changed = false;
  try {
    for (let i = 0; i < addrs.length; i += STAMP_LOOKUP_CHUNK) {
      const chunk = addrs.slice(i, i + STAMP_LOOKUP_CHUNK);
      const names = await lookupNamesChunk(chunk);
      if (names && applyNames(s, chunk, names)) changed = true;
      chunk.forEach((a) => s.pending.delete(a));
    }
  } finally {
    addrs.forEach((a) => s.pending.delete(a));
    if (changed) notify(s);
  }
  void resolveOnchainBatch(s, addrs);
}

function ensure(s: State, addresses: (string | null | undefined)[]): void {
  const needsLookup = (address: string): boolean => {
    const entry = s.store.get(address);
    return (!entry || entry.stale === true) && !s.pending.has(address);
  };
  const todo = [...new Set(addresses.filter((a): a is string => typeof a === 'string' && a.length > 0).map((a) => a.toLowerCase()))].filter(
    needsLookup,
  );
  if (!todo.length) return;
  todo.forEach((a) => s.pending.add(a));
  void fetchBatch(s, todo);
}

function seed(s: State, entries: PeerProfileEntries): void {
  let added = false;
  for (const [address, entry] of Object.entries(entries)) {
    const key = address.toLowerCase();
    if (s.store.has(key)) continue;
    const persisted = typeof entry === 'object' && entry !== null ? entry : { name: entry };
    s.store.set(key, {
      name: persisted.name ?? undefined,
      displayName: persisted.displayName,
      description: persisted.description,
      avatar: persisted.avatar,
      source: persisted.source,
      stale: true,
    });
    added = true;
  }
  if (added) notify(s);
}

function entriesOf(s: State): PeerProfileEntries {
  const out: PeerProfileEntries = {};
  for (const [address, profile] of s.store) {
    out[address] =
      profile.avatar === undefined && profile.source === undefined
        ? (profile.name ?? null)
        : {
            name: profile.name ?? null,
            displayName: profile.displayName,
            description: profile.description,
            avatar: profile.avatar,
            source: profile.source,
          };
  }
  return out;
}

function invalidate(s: State, address: string): void {
  const key = address.toLowerCase();
  const entry = s.store.get(key);
  if (entry) s.store.set(key, { ...entry, stale: true });
  ensure(s, [key]);
}

function peerName(profile: PeerProfile | undefined): string | undefined {
  const display = profile?.displayName?.trim();
  if (display) return display;
  const name = profile?.name?.trim();
  return name ? displayHandle(name) : undefined;
}

export function createPeerProfiles(options: PeerProfilesOptions = {}): PeerProfiles {
  const s: State = { store: new Map(), pending: new Set(), listeners: new Set(), resolveOnchain: options.resolveOnchain };
  const profileOf = (address?: string | null): PeerProfile | undefined => (address ? s.store.get(address.toLowerCase()) : undefined);
  const name = (address?: string | null): string | undefined => peerName(profileOf(address));
  return {
    ensure: (addresses) => {
      ensure(s, addresses);
    },
    seed: (entries) => {
      seed(s, entries);
    },
    entries: () => entriesOf(s),
    invalidate: (address) => {
      invalidate(s, address);
    },
    isResolved: (address) => !!address && s.store.has(address.toLowerCase()),
    name,
    displayName: (address) => profileOf(address)?.displayName,
    handle: (address) => {
      const n = profileOf(address)?.name;
      return n?.trim() ? n.trim() : undefined;
    },
    description: (address) => profileOf(address)?.description,
    avatar: (address) => profileOf(address)?.avatar,
    source: (address) => profileOf(address)?.source,
    label: (address) => name(address) ?? shortAddress(address),
    subscribe: (listener) => {
      s.listeners.add(listener);
      return () => {
        s.listeners.delete(listener);
      };
    },
  };
}
