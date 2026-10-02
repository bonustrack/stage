import type { HistoryEntry } from '@stage-labs/client/types';
import { clearAppDataWrites } from '@stage-labs/client/xmtp/labels';
import { makeListeners, useStoreValue } from './storeCore';
import { resetFeedLines } from './feedLines';

export const inboxEthCache = new Map<string, string>();

const feedSlices = new Map<string, HistoryEntry[]>();
const feedChanges = makeListeners<{ line: string; slice: HistoryEntry[] | undefined }>();

export const feedCache = {
  get: (line: string): HistoryEntry[] | undefined => feedSlices.get(line),
  set(line: string, slice: HistoryEntry[]): void {
    feedSlices.set(line, slice);
    feedChanges.notify({ line, slice });
  },
  subscribeAll(cb: (line: string, slice: HistoryEntry[] | undefined) => void): () => void {
    return feedChanges.subscribe(({ line, slice }) => { cb(line, slice); });
  },
  clear(): void {
    const lines = [...feedSlices.keys()];
    feedSlices.clear();
    for (const line of lines) feedChanges.notify({ line, slice: undefined });
  },
};

export { activeFeedLines } from './feedLines';

export type XmtpBootstrapPhase = 'idle' | 'registering';

let bootstrapPhase: XmtpBootstrapPhase = 'idle';
const bootstrap = makeListeners();

function setXmtpBootstrapPhase(next: XmtpBootstrapPhase): void {
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
  clearAppDataWrites();
  globalStreamTeardown?.();
  resetFeedLines();
  feedCache.clear();
  inboxEthCache.clear();
}

const READY_CAP_MS = 60_000;

interface ClientSlot<C> {
  get: () => C | null;
  set: (client: C | null) => void;
  getOrCreate: (create: () => Promise<C>) => Promise<C>;
  waitForReady: () => Promise<boolean>;
  reset: () => void;
}

export function createClientSlot<C>(onReset: () => void): ClientSlot<C> {
  let cached: C | null = null;
  let inFlight: Promise<C> | null = null;
  return {
    get: () => cached,
    set: (client) => { cached = client; },
    getOrCreate: async (create) => {
      if (cached) return cached;
      if (inFlight) return inFlight;
      const pending = create();
      inFlight = pending;
      try { return await pending; } finally { if (inFlight === pending) inFlight = null; }
    },
    waitForReady: async () => {
      const start = Date.now();
      while (cached === null && Date.now() - start < READY_CAP_MS) await new Promise((r) => setTimeout(r, 250));
      return cached !== null;
    },
    reset: () => {
      cached = null;
      inFlight = null;
      onReset();
    },
  };
}
