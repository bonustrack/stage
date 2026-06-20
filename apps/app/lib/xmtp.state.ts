/** @file Shared client-scoped mutable state (cached client plus inbox-keyed session caches) for the XMTP client lib, extracted to break the client-lifecycle/feed module cycle; internal plumbing, not re-exported. */

import type { Client } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { MemoryStore } from './cache';

let cachedClient: Client | null = null;

/** The cached XMTP client for the current inbox, or null before onboarding. */
export function getCachedXmtpClient(): Client | null { return cachedClient; }
/** Cache (or clear) the active XMTP client. */
export function setCachedXmtpClient(client: Client | null): void { cachedClient = client; }

/** Resolve once the XMTP client is cached (or after `capMs`) so heavy native consumers serialize behind onboarding; only polls (never triggers create), and the cap stops a failed onboarding wedging the Private tab. */
export async function waitForXmtpReady(capMs = 60_000): Promise<boolean> {
  if (cachedClient) return true;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (cachedClient) return true;
  }
  return false;
}

/** Inbox id → ETH address cache; identities are stable so we resolve once and reuse, keeping channel re-summarizes under XMTP's read rate limit. */
export const inboxEthCache = new MemoryStore<string, string>();

/** Per-conversation message cache so re-opening a channel renders its messages instantly (no empty-state flash); the network history still refreshes in the background. Survives navigation within the session. */
export const feedCache = new MemoryStore<string, HistoryEntry[]>();

/** Conv lines with at least one live subscriber — drives which slices the global resync backstop refreshes (we don't resync every conv the inbox has ever seen, only the ones currently being viewed). */
export const activeFeedLines = new Set<string>();

/** The feed module registers its `teardownGlobalStream` here so the client module's `resetClientScopedState` can tear the stream down on account switch without importing the feed module (which would re-create the cycle). */
let globalStreamTeardown: (() => void) | null = null;
/** Register the feed module's global-stream teardown for cross-module reset. */
export function registerGlobalStreamTeardown(fn: () => void): void { globalStreamTeardown = fn; }

/** Drop all client-scoped in-memory state on account change (cached client, global stream + backstops, inbox-keyed session caches); the account-scoped persisted channels-list cache is left intact for instant re-open. */
export function resetClientScopedState(): void {
  cachedClient = null;
  globalStreamTeardown?.();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}
