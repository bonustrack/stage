import type { HistoryEntry } from '@stage-labs/client/types';
import { MemoryStore } from './cache';

export const inboxEthCache = new MemoryStore<string, string>();

export const feedCache = new MemoryStore<string, HistoryEntry[]>();

export const activeFeedLines = new Set<string>();

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
  waitForReady: (capMs?: number) => Promise<boolean>;
  reset: () => void;
}

export function createClientSlot<C>(): ClientSlot<C> {
  let cached: C | null = null;
  return {
    get: () => cached,
    set: (client) => { cached = client; },
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
