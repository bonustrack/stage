import type { HistoryEntry } from '@stage-labs/client/types';
import { MemoryStore } from './cache.shared';
import { makeListeners, useStoreValue } from './storeCore';

export const inboxEthCache = new MemoryStore<string, string>();

export const feedCache = new MemoryStore<string, HistoryEntry[]>();

export const activeFeedLines = new Set<string>();

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
  globalStreamTeardown?.();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}
