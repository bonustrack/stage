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
