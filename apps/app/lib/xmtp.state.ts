
import type { Client } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { MemoryStore } from './cache';

let cachedClient: Client | null = null;

export function getCachedXmtpClient(): Client | null { return cachedClient; }
export function setCachedXmtpClient(client: Client | null): void { cachedClient = client; }

export async function waitForXmtpReady(capMs = 60_000): Promise<boolean> {
  if (cachedClient) return true;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (cachedClient) return true;
  }
  return false;
}

export const inboxEthCache = new MemoryStore<string, string>();

export const feedCache = new MemoryStore<string, HistoryEntry[]>();

export const activeFeedLines = new Set<string>();

let globalStreamTeardown: (() => void) | null = null;
export function registerGlobalStreamTeardown(fn: () => void): void { globalStreamTeardown = fn; }

export function resetClientScopedState(): void {
  cachedClient = null;
  globalStreamTeardown?.();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}
