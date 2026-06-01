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

export function getCachedXmtpClient(): Client | null { return cachedClient; }
export function setCachedXmtpClient(client: Client | null): void { cachedClient = client; }

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
