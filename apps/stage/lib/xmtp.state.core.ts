import type { HistoryEntry } from '@stage-labs/client/types';
import { MemoryStore } from './cache';
import { makeListeners, useStoreValue } from './storeCore';

export const inboxEthCache = new MemoryStore<string, string>();

export const feedCache = new MemoryStore<string, HistoryEntry[]>();

export const activeFeedLines = new Set<string>();

export type XmtpBootstrapPhase = 'idle' | 'registering';

let bootstrapPhase: XmtpBootstrapPhase = 'idle';
const bootstrap = makeListeners();

export function setXmtpBootstrapPhase(next: XmtpBootstrapPhase): void {
  bootstrapPhase = next;
  bootstrap.notify();
}

export function getXmtpBootstrapPhase(): XmtpBootstrapPhase { return bootstrapPhase; }

export function useXmtpBootstrapPhase(): XmtpBootstrapPhase {
  return useStoreValue(bootstrap.subscribe, getXmtpBootstrapPhase);
}

export async function whileRegistering<T>(work: () => Promise<T>): Promise<T> {
  setXmtpBootstrapPhase('registering');
  try { return await work(); } finally { setXmtpBootstrapPhase('idle'); }
}

let globalStreamTeardown: (() => void) | null = null;
export function registerGlobalStreamTeardown(fn: () => void): void { globalStreamTeardown = fn; }

export function resetSharedXmtpState(): void {
  globalStreamTeardown?.();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}

export interface ClientSlot<C> {
  get: () => C | null;
  set: (client: C | null) => void;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  waitForReady: (capMs?: number) => Promise<boolean>;
  reset: () => void;
}

export function createClientSlot<C>(): ClientSlot<C> {
  let cached: C | null = null;
  let inFlight: Promise<C> | null = null;
  return {
    get: () => cached,
    set: (client) => { cached = client; },
    getOrCreate: async (create) => {
      if (cached) return cached;
      if (inFlight) return inFlight;
      inFlight = create();
      try { return await inFlight; } finally { inFlight = null; }
    },
    waitForReady: async (capMs = 60_000) => {
      const start = Date.now();
      while (cached === null && Date.now() - start < capMs) await new Promise((r) => setTimeout(r, 250));
      return cached !== null;
    },
    reset: () => {
      cached = null;
      resetSharedXmtpState();
    },
  };
}
