/** Cross-device + cross-install sync of per-channel UI preferences over a
 *  single-member MLS group the user OWNS — a "self-group" used as a replicated,
 *  append-only, fully-E2E log. No server, no new backend: same-inbox new
 *  installs auto-join the group via XMTP History Sync, then replay the log to
 *  rehydrate before the Channels list paints.
 *
 *  Wire format + merge/compaction rules live in
 *  @stage-labs/client/xmtp/channelPrefs (pure, unit-tested). This module is the
 *  RN glue: find-or-create the group, fold the log into the device-local stores
 *  on boot/foreground, stream it live, and periodically compact to a snapshot.
 *
 *  TWO durability classes, by write frequency:
 *
 *   - ARCHIVE / PINS / MUTED — RARE per-event LWW deltas. toggleArchived /
 *     togglePin keep their instant local write AND call queuePrefDelta(...),
 *     which coalesces a burst into one group message. Fine to log per event.
 *
 *   - READ-STATE — too high-frequency for a per-event log (Less's pushback,
 *     2026-06). It does NOT flow through queuePrefDelta. It lives behind a
 *     pluggable provider (lib/readState.ts): the durable cursor for a conv is
 *     max(your last SENT msg ts — synced FREE by XMTP, a fallback cursor). The
 *     fallback cursor is published AT MOST ONCE per app-background as a single
 *     coalesced LWW register (`flushReadCursorsOnBackground`); inbound remote
 *     cursors fold into the provider, never per-read into SecureStore. This
 *     write path is HELD pending Less's poll (piggyback+fallback / device-local
 *     / backend-kv) — gated by ENABLE_READ_CURSOR_PUBLISH below.
 *
 *  Pure JS — no native deps, hot-reloadable. */

import * as SecureStore from 'expo-secure-store';
import {
  foldChannelPrefs, toSnapshotEntries, buildReadCursorDelta,
  type ChannelPrefEntry, type ChannelPrefsMessage, type MergedPref,
} from '@stage-labs/client/xmtp/channelPrefs';
import { getCachedXmtpClient, getOrCreateXmtpClient } from './xmtp.client';
import { CHANNEL_PREFS_CODEC } from './xmtp.codecs';
import { loadArchivedIds, applyArchivedFromSync } from './archived';
import { loadPinnedIds, applyPinnedFromSync } from './pins';
import { readState } from './readState';

/** Read-state durable WRITE path gate. The provider + background-coalesced
 *  publish are fully built, but kept OFF until Less's poll picks the strategy
 *  (piggyback+fallback / read stays device-local / small backend KV). With this
 *  false, read state is derived locally (free same-account sync still comes from
 *  XMTP's own sent-message history via the provider's piggyback), and NO read
 *  cursor is published to the self-group. Flip to true once the poll lands. */
const ENABLE_READ_CURSOR_PUBLISH = false;

/** Stable sentinel stamped on the control group's name + description so we can
 *  rediscover it after History Sync replays it onto a fresh install (the group
 *  id isn't known there). Also cached in SecureStore once found. */
const SENTINEL = 'stage.app/channel-prefs';
const GROUP_ID_KEY = 'channelPrefs.groupId';
const MIGRATED_KEY = 'channelPrefs.migrated';
/** Post a compaction snapshot once this many deltas have accrued since the last
 *  snapshot, so cold-start replay stays bounded. */
const COMPACT_AFTER = 50;

/** Minimal structural views over the RN SDK group + message shapes we touch, so
 *  this file needs no @xmtp/react-native-sdk import (keeps it codec-light). */
interface PrefGroup {
  id: string;
  name?: string;
  sync: () => Promise<unknown>;
  send: (content: unknown, opts?: { contentType: unknown }) => Promise<string>;
  messages: (opts?: { limit?: number }) => Promise<PrefMessage[]>;
  stream?: (cb: (m: PrefMessage) => void) => Promise<() => void>;
}
interface PrefMessage {
  contentTypeId?: string;
  content: () => unknown;
}
interface GroupConversations {
  syncAllConversations?: (states?: string[]) => Promise<unknown>;
  list: (...args: unknown[]) => Promise<PrefGroup[]>;
  newGroupWithIdentities: (peers: unknown[], opts?: Record<string, unknown>) => Promise<PrefGroup>;
  findConversation: (id: unknown) => Promise<PrefGroup | null>;
  streamAllMessages?: unknown;
}

/** The control-group content type string the SDK stamps on inbound messages. */
const PREFS_TYPE_ID = 'stage.app/channel-prefs:1.0';

let cachedGroup: PrefGroup | null = null;
let deltaCount = 0;            // deltas posted since the last snapshot this session
let liveUnsub: (() => void) | null = null;

// ---------------------------------------------------------------------------
// Group find-or-create
// ---------------------------------------------------------------------------

/** Resolve (and memoise) the user's control group, creating it on first run.
 *  Lookup order: in-memory cache -> SecureStore-cached id -> scan groups for the
 *  sentinel (covers History-Synced fresh installs) -> create a new self-group. */
async function getControlGroup(): Promise<PrefGroup | null> {
  if (cachedGroup) return cachedGroup;
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production').catch(() => null);
  if (!client) return null;
  const convs = client.conversations as unknown as GroupConversations;

  /** Cached id from a previous session. */
  try {
    const id = await SecureStore.getItemAsync(GROUP_ID_KEY);
    if (id) {
      const g = await convs.findConversation(id).catch(() => null);
      if (g) return (cachedGroup = g);
    }
  } catch { /* fall through to scan */ }

  /** Scan local groups for our sentinel name — this is how a fresh install
   *  picks up the group that History Sync replayed in. */
  try {
    await convs.syncAllConversations?.(['allowed']);
    const groups = await convs.list().catch(() => [] as PrefGroup[]);
    const found = groups.find(g => g.name === SENTINEL);
    if (found) { await cacheGroupId(found.id); return (cachedGroup = found); }
  } catch { /* fall through to create */ }

  /** Create the single-member self-group. Members = just us: pass no peer
   *  identities; the creator's own inbox is the sole member. Name + description
   *  carry the sentinel so other installs rediscover it by scan. */
  try {
    const inboxId = (client as unknown as { inboxId: string }).inboxId;
    const g = await convs.newGroupWithIdentities([], {
      name: SENTINEL, description: `${SENTINEL} (inbox ${inboxId})`,
    });
    await cacheGroupId(g.id);
    return (cachedGroup = g);
  } catch {
    return null; // group create failed (offline); next boot retries
  }
}

async function cacheGroupId(id: string): Promise<void> {
  try { await SecureStore.setItemAsync(GROUP_ID_KEY, id); } catch { /* best-effort */ }
}

// ---------------------------------------------------------------------------
// Read / fold / hydrate
// ---------------------------------------------------------------------------

/** Pull every prefs message off the control group and fold it (newest writer
 *  wins per field; snapshots bound replay). Returns the merged map. */
async function foldGroup(group: PrefGroup): Promise<Map<string, MergedPref>> {
  await group.sync().catch(() => undefined);
  const raw = await group.messages({ limit: 2000 }).catch(() => [] as PrefMessage[]);
  const msgs: ChannelPrefsMessage[] = [];
  for (const m of raw) {
    if (m.contentTypeId !== PREFS_TYPE_ID) continue;
    try {
      const c = m.content();
      if (c && typeof c === 'object') msgs.push(c as ChannelPrefsMessage);
    } catch { /* undecodable / drifted — skip */ }
  }
  return foldChannelPrefs(msgs);
}

/** Apply a merged map onto the device-local stores + read-state provider.
 *
 *  archived / pinned -> per-conv applyFromSync (no re-emit, no feedback loop).
 *  `muted` is carried in the wire format for forward-compat but has no local
 *  store yet. READ cursors are NOT written to SecureStore here — they fold into
 *  the read-state provider (LWW by ns), the single source unread derivation
 *  reads from. This keeps read state off the per-event hot path and lets the
 *  eventual strategy (Less's poll) swap without touching this fold. */
async function hydrateStores(merged: Map<string, MergedPref>): Promise<void> {
  await Promise.all([loadArchivedIds(), loadPinnedIds()]);
  for (const [convId, m] of merged) {
    if (m.archived !== undefined) applyArchivedFromSync(convId, m.archived);
    if (m.pinned !== undefined) applyPinnedFromSync(convId, m.pinned);
    if (m.lastReadNs !== undefined) {
      const remote = Number(m.lastReadNs);
      if (Number.isFinite(remote) && remote > 0) {
        readState().applyRemoteFallback(convId, remote);
      }
    }
  }
}

/** Boot / foreground entry point: find-or-create the group, run the one-time
 *  migration if needed, fold + hydrate, then attach the live stream once.
 *  Fire-and-forget; never throws (best-effort sync). */
export async function syncChannelPrefs(): Promise<void> {
  try {
    const group = await getControlGroup();
    if (!group) return;
    await migrateOnce(group);
    const merged = await foldGroup(group);
    await hydrateStores(merged);
    await attachLiveStream(group);
    await maybeCompact(group, merged);
  } catch { /* best-effort */ }
}

/** Subscribe to the control group for real-time cross-device updates. Idempotent
 *  — only one stream is attached per session. */
async function attachLiveStream(group: PrefGroup): Promise<void> {
  if (liveUnsub || !group.stream) return;
  try {
    liveUnsub = await group.stream(async (m) => {
      if (m.contentTypeId !== PREFS_TYPE_ID) return;
      try {
        const c = m.content();
        if (!c || typeof c !== 'object') return;
        await hydrateStores(foldChannelPrefs([c as ChannelPrefsMessage]));
      } catch { /* skip undecodable */ }
    });
  } catch { /* stream unsupported — boot/foreground fold still covers it */ }
}

/** Tear down the live stream (account switch / sign-out). */
export function stopChannelPrefsSync(): void {
  if (liveUnsub) { try { liveUnsub(); } catch { /* ignore */ } liveUnsub = null; }
  cachedGroup = null;
  deltaCount = 0;
}

// ---------------------------------------------------------------------------
// Write path — coalesced deltas
// ---------------------------------------------------------------------------

/** Pending per-conv field changes, merged until the debounce flushes so a burst
 *  (e.g. archive + read) collapses into ONE group message. */
const pending = new Map<string, ChannelPrefEntry>();
let flushTimer: ReturnType<typeof setTimeout> | null = null;
const DEBOUNCE_MS = 400;

/** Record a single-field RARE change (archived / pinned / muted) and schedule a
 *  coalesced send. Called from toggleArchived / togglePin AFTER they persist
 *  locally, so the UI is instant and the network send is best-effort.
 *
 *  Read state does NOT go through here — `patch` deliberately excludes
 *  `lastReadNs`. Read cursors are published once per background; see
 *  `flushReadCursorsOnBackground`. */
export function queuePrefDelta(
  convId: string,
  patch: Pick<Partial<ChannelPrefEntry>, 'archived' | 'pinned' | 'muted'>,
): void {
  const ts = Date.now();
  const cur = pending.get(convId) ?? { ts };
  pending.set(convId, { ...cur, ...patch, ts });
  if (flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; void flushDeltas(); }, DEBOUNCE_MS);
}

async function flushDeltas(): Promise<void> {
  if (pending.size === 0) return;
  const entries: Record<string, ChannelPrefEntry> = {};
  for (const [k, v] of pending) entries[k] = v;
  pending.clear();
  const group = await getControlGroup();
  if (!group) return; // offline / not ready — change is already local; next boot snapshot carries it
  const msg: ChannelPrefsMessage = { v: 1, entries };
  try {
    await group.send(msg, { contentType: CHANNEL_PREFS_CODEC.contentType });
    deltaCount += 1;
    if (deltaCount >= COMPACT_AFTER) void maybeCompact(group);
  } catch { /* send failed — local state stands; reconciled by next snapshot */ }
}

// ---------------------------------------------------------------------------
// Read-cursor publish — coalesced, background-only (NOT a per-read delta)
// ---------------------------------------------------------------------------

/** Publish the FALLBACK read cursor for every conv whose cursor advanced since
 *  the last publish, as ONE coalesced LWW-register message. Called only on app
 *  background (see `flushChannelPrefsOnBackground`). Reads happen constantly, so
 *  this is the single, rate-bounded write for read state — never per-read.
 *
 *  HELD behind ENABLE_READ_CURSOR_PUBLISH pending Less's poll: while off, we
 *  still DRAIN the provider (so the dirty set doesn't grow unbounded) but send
 *  nothing — read state stays device-local plus the provider's free piggyback on
 *  XMTP-synced sent messages. Flip the flag on to enable the durable write. */
async function flushReadCursorsOnBackground(): Promise<void> {
  const cursors = readState().drainFallbackCursors();
  if (!ENABLE_READ_CURSOR_PUBLISH) return;
  const msg = buildReadCursorDelta(cursors);
  if (!msg) return;
  const group = await getControlGroup();
  if (!group) return;
  try {
    await group.send(msg, { contentType: CHANNEL_PREFS_CODEC.contentType });
    deltaCount += 1;
  } catch { /* best-effort — cursor reconverges on next background publish */ }
}

// ---------------------------------------------------------------------------
// Compaction
// ---------------------------------------------------------------------------

/** Post a full-state snapshot when enough deltas have accrued, collapsing the
 *  log so a fresh install replays a bounded number of messages. Reads the latest
 *  merged state (folding the group if not supplied) and posts it as one
 *  `snapshot:true` message; merge then ignores every delta with ts <= its ts. */
async function maybeCompact(group: PrefGroup, merged?: Map<string, MergedPref>): Promise<void> {
  if (deltaCount < COMPACT_AFTER && merged) return;
  try {
    const state = merged ?? await foldGroup(group);
    const entries = toSnapshotEntries(state);
    if (Object.keys(entries).length === 0) return;
    const snap: ChannelPrefsMessage = { v: 1, snapshot: true, ts: Date.now(), entries };
    await group.send(snap, { contentType: CHANNEL_PREFS_CODEC.contentType });
    deltaCount = 0;
  } catch { /* best-effort */ }
}

/** Flush on app background: ship any pending archive/pin/mute deltas, publish
 *  the coalesced read cursor ONCE (the only read-state write, and only when the
 *  poll-gated flag is on), then maybe snapshot. A kill never strands queued
 *  deltas and the next install's replay stays compact. */
export async function flushChannelPrefsOnBackground(): Promise<void> {
  if (flushTimer) { clearTimeout(flushTimer); flushTimer = null; }
  await flushDeltas();
  await flushReadCursorsOnBackground();
  const group = cachedGroup;
  if (group) await maybeCompact(group);
}

// ---------------------------------------------------------------------------
// Migration — first run seeds the group from existing local state
// ---------------------------------------------------------------------------

/** On the very first run after this ships (no migration flag), push ONE snapshot
 *  built from the CURRENT device-local archived + pinned sets so the control
 *  group starts from this device's truth instead of empty. Idempotent: guarded
 *  by a SecureStore flag and only seeds when the group has no prefs messages yet
 *  (a History-Synced install must NOT clobber the existing log). */
async function migrateOnce(group: PrefGroup): Promise<void> {
  try {
    if (await SecureStore.getItemAsync(MIGRATED_KEY)) return;
    /** If the group already carries state (this inbox migrated on another
     *  install), don't seed again — just mark migrated. */
    const existing = await foldGroup(group);
    if (existing.size === 0) {
      const [archived, pinned] = await Promise.all([loadArchivedIds(), loadPinnedIds()]);
      const ts = Date.now();
      const entries: Record<string, ChannelPrefEntry> = {};
      for (const id of archived) entries[id] = { ...(entries[id] ?? { ts }), archived: true, ts };
      for (const id of pinned) entries[id] = { ...(entries[id] ?? { ts }), pinned: true, ts };
      /** lastReadNs lives in SecureStore keyed per conv with no enumeration API;
       *  it converges naturally as each conv is read/marked post-migration. */
      if (Object.keys(entries).length > 0) {
        const snap: ChannelPrefsMessage = { v: 1, snapshot: true, ts, entries };
        await group.send(snap, { contentType: CHANNEL_PREFS_CODEC.contentType });
      }
    }
    await SecureStore.setItemAsync(MIGRATED_KEY, '1');
  } catch { /* migration is best-effort; retried next boot until the flag sets */ }
}
