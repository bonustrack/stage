/** Shared client-scoped mutable state for the app's XMTP client lib.
 *  Extracted from lib/xmtp.ts (phase-2 lint split) to break the cycle between
 *  the client-lifecycle module (which must reset feed/stream state on account
 *  switch) and the feed module (which owns the global stream). Holds the cached
 *  client + every session cache keyed to the current inbox.
 *
 *  Not re-exported from lib/xmtp.ts — internal plumbing only. */

import type { Client } from '@xmtp/react-native-sdk';
import type { HistoryEntry } from './types';
import { MemoryStore } from './cache';

let cachedClient: Client | null = null;

/** The cached XMTP client for the current inbox, or null before onboarding. */
export function getCachedXmtpClient(): Client | null { return cachedClient; }
/** Cache (or clear) the active XMTP client. */
export function setCachedXmtpClient(client: Client | null): void { cachedClient = client; }

/** Resolve once the XMTP client is built/created (or after `capMs`), so heavy
 *  native consumers (the Railgun nodejs-mobile engine boot) can SERIALIZE behind
 *  XMTP onboarding instead of racing `Client.create`'s native MLS/SQLCipher
 *  handshake on first launch. Polls the cache — getOrCreateXmtpClient runs on
 *  boot from HomeScreen.sync, so we only wait, never trigger create here. The
 *  cap means a failed onboarding won't wedge the Private tab forever. */
export async function waitForXmtpReady(capMs = 60_000): Promise<boolean> {
  if (cachedClient) return true;
  const start = Date.now();
  while (Date.now() - start < capMs) {
    await new Promise((r) => setTimeout(r, 250));
    if (cachedClient) return true;
  }
  return false;
}

/** inbox id → ETH address cache. An inbox's ETH identity is stable, so once
 *  resolved we never hit the identity API for it again. This is the key to
 *  staying under XMTP's read rate limit: channel re-summarizes (30s poll,
 *  per-message stream, AppState resume, pull-to-refresh) reuse cached identities
 *  instead of calling GetIdentityUpdates per member on every pass. */
export const inboxEthCache = new MemoryStore<string, string>();

/** Per-conversation message cache so re-opening a channel renders its messages
 *  instantly (no empty-state flash); the network history still refreshes in the
 *  background. Survives navigation within the session. */
export const feedCache = new MemoryStore<string, HistoryEntry[]>();

/** Conv lines with at least one live subscriber — drives which slices the global
 *  resync backstop refreshes (we don't resync every conv the inbox has ever
 *  seen, only the ones currently being viewed). */
export const activeFeedLines = new Set<string>();

/** The feed module registers its `teardownGlobalStream` here so the client
 *  module's `resetClientScopedState` can tear the stream down on account switch
 *  without importing the feed module (which would re-create the cycle). */
let globalStreamTeardown: (() => void) | null = null;
/** Register the feed module's global-stream teardown for cross-module reset. */
export function registerGlobalStreamTeardown(fn: () => void): void { globalStreamTeardown = fn; }

/** Drop all client-scoped in-memory state on an account change: the cached
 *  client, the single global message stream + its backstops, and every session
 *  cache that's keyed to the previous inbox (per-conv feeds, inbox→eth). The
 *  persisted channels-list cache is NOT cleared — it's account-scoped (one store
 *  per account id), so switchToAccount → setActiveAccountId just repoints it at
 *  the target account's store, keeping every account's rows cached for an instant
 *  re-open. */
export function resetClientScopedState(): void {
  cachedClient = null;
  globalStreamTeardown?.();
  activeFeedLines.clear();
  feedCache.clear();
  inboxEthCache.clear();
}
