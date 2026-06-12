/** Channel-preferences sync — `stage.app/channel-prefs:1.0`.
 *
 *  Cross-device + cross-install sync of per-conversation UI state (archived,
 *  pinned, muted, last-read marker) over a single-member MLS group the user
 *  owns (a "self-group" used as a replicated append log — fully E2E, serverless;
 *  same-inbox new installs auto-join via XMTP History Sync). See
 *  apps/app/lib/channelPrefsSync.ts for the RN client that finds/creates the
 *  group, sends deltas, and folds them back into the device-local stores.
 *
 *  Pure TS (no @xmtp / react-native / expo imports): wire shapes, content-type
 *  descriptor, and the merge/fold/compaction logic, so the last-writer-wins +
 *  snapshot rules are unit-testable in isolation from the SDK. */

import type { XmtpContentTypeId } from './codecs';

/** `stage.app/channel-prefs:1.0`. Stage authority (distinct from `metro.box`
 *  poll/signature types) since this is Stage-app device state, not a chat
 *  content type other clients render. */
export const CHANNEL_PREFS_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'stage.app', typeId: 'channel-prefs', versionMajor: 1, versionMinor: 0,
};

/** Per-conversation preference fields. Every field is optional so a delta can
 *  carry just the one that changed; `ts` is the wall-clock (ms) of the write
 *  that produced this entry and drives per-field last-writer-wins on merge.
 *
 *  `lastReadNs` is a STRING (nanosecond XMTP `sentNs`, JSON-safe — outside the
 *  IEEE-754 safe-integer range as a number).
 *
 *  READ-STATE (design change, 2026-06): `lastReadNs` is NOT a per-read delta.
 *  Read state is derived by the device from a pluggable provider whose primary
 *  cursor is `max(your last SENT message ts in the conv [synced by XMTP for
 *  free], a fallback cursor)`. This `lastReadNs` field carries ONLY that
 *  FALLBACK cursor — for convs read but never replied to — and is published at
 *  most ONCE per app-background as a single coalesced LWW register, never one
 *  message per read. archived/pinned/muted remain rare per-event LWW deltas. */
export interface ChannelPrefEntry {
  archived?: boolean;
  pinned?: boolean;
  muted?: boolean;
  /** FALLBACK read cursor only (see file header) — a coalesced LWW register,
   *  not a per-read delta. */
  lastReadNs?: string;
  /** Wall-clock ms when this entry was written (LWW key). */
  ts: number;
}

/** One sync message: a map of convId -> entry. A normal write is a one-entry
 *  delta; a compaction is a full-state `snapshot` carrying every known conv. */
export interface ChannelPrefsMessage {
  v: 1;
  /** True for a compaction snapshot — merge discards any delta with
   *  `ts <= snapshot.ts`, bounding replay. */
  snapshot?: boolean;
  /** Snapshot wall-clock ms (snapshots only). Deltas have no top-level ts. */
  ts?: number;
  entries: Record<string, ChannelPrefEntry>;
}

/** Merged per-conv state: the same fields as an entry, but each resolved
 *  independently to its latest writer, so we track a per-FIELD timestamp. */
export interface MergedPref {
  archived?: boolean;
  pinned?: boolean;
  muted?: boolean;
  lastReadNs?: string;
  /** Per-field LWW timestamps (ms). Internal to the fold; not persisted. */
  _ts: { archived?: number; pinned?: number; muted?: number; lastReadNs?: number };
}

const FIELDS = ['archived', 'pinned', 'muted', 'lastReadNs'] as const;
type Field = typeof FIELDS[number];

/** Fold a single entry into the accumulating merged state with per-FIELD
 *  last-writer-wins: a field only overwrites when this entry's `ts` is strictly
 *  newer than the ts that last set that field. Entries are processed in any
 *  order; the result is identical (commutative LWW). */
function foldEntry(into: Map<string, MergedPref>, convId: string, entry: ChannelPrefEntry): void {
  const cur = into.get(convId) ?? { _ts: {} };
  for (const f of FIELDS) {
    const v = entry[f];
    if (v === undefined) continue;
    const prevTs = cur._ts[f] ?? -1;
    if (entry.ts > prevTs) {
      (cur as Record<Field, unknown>)[f] = v;
      cur._ts[f] = entry.ts;
    }
  }
  into.set(convId, cur);
}

/** Fold an ordered list of sync messages into the merged per-conv map.
 *
 *  Messages may be passed in ANY order (the fold is commutative). Compaction:
 *  the newest snapshot's `ts` becomes a floor — every entry from a snapshot is
 *  stamped with the snapshot ts, and any delta entry with `ts <= floor` is
 *  ignored, so replay stays bounded after a snapshot is posted. */
export function foldChannelPrefs(messages: ChannelPrefsMessage[]): Map<string, MergedPref> {
  const floor = messages.reduce(
    (m, msg) => (msg.snapshot && typeof msg.ts === 'number' && msg.ts > m ? msg.ts : m),
    -1,
  );
  const merged = new Map<string, MergedPref>();
  for (const msg of messages) {
    if (!msg || msg.v !== 1 || !msg.entries) continue;
    const isSnap = !!msg.snapshot && typeof msg.ts === 'number';
    for (const [convId, entry] of Object.entries(msg.entries)) {
      if (!entry || typeof entry.ts !== 'number') continue;
      /** Snapshot entries are stamped with the snapshot ts (the floor); plain
       *  deltas older than the floor are superseded by that snapshot. */
      const ts = isSnap ? (msg.ts as number) : entry.ts;
      if (!isSnap && ts <= floor) continue;
      foldEntry(merged, convId, { ...entry, ts });
    }
  }
  return merged;
}

/** Strip the internal per-field ts bookkeeping, yielding the plain entries map
 *  suitable for a snapshot message (`ts` per entry = its newest field ts). */
export function toSnapshotEntries(merged: Map<string, MergedPref>): Record<string, ChannelPrefEntry> {
  const out: Record<string, ChannelPrefEntry> = {};
  for (const [convId, m] of merged) {
    const ts = Math.max(0, ...Object.values(m._ts).filter((n): n is number => typeof n === 'number'));
    const entry: ChannelPrefEntry = { ts };
    if (m.archived !== undefined) entry.archived = m.archived;
    if (m.pinned !== undefined) entry.pinned = m.pinned;
    if (m.muted !== undefined) entry.muted = m.muted;
    if (m.lastReadNs !== undefined) entry.lastReadNs = m.lastReadNs;
    out[convId] = entry;
  }
  return out;
}

/** Which pref field a delta touches. `read` is the FALLBACK read cursor (see
 *  the file header) — coalesced + background-only, never per-read. */
export type PrefField = 'archived' | 'pinned' | 'muted' | 'read';

/** Build a single-field delta message for one conversation. `ts` defaults to
 *  now; pass an explicit ts in tests for determinism. The caller sends this as
 *  the codec body over the self-group. */
export function buildPrefDelta(
  convId: string,
  field: PrefField,
  value: boolean | string,
  ts: number = Date.now(),
): ChannelPrefsMessage {
  const entry: ChannelPrefEntry = { ts };
  if (field === 'read') entry.lastReadNs = String(value);
  else entry[field] = value as boolean;
  return { v: 1, entries: { [convId]: entry } };
}

/** Build a coalesced read-cursor delta carrying the FALLBACK cursor for every
 *  conv whose cursor advanced since the last publish. One message on app
 *  background replaces N per-read writes. Empty input → null (nothing to send). */
export function buildReadCursorDelta(
  cursors: Record<string, string>,
  ts: number = Date.now(),
): ChannelPrefsMessage | null {
  const entries: Record<string, ChannelPrefEntry> = {};
  for (const [convId, ns] of Object.entries(cursors)) {
    if (ns) entries[convId] = { lastReadNs: ns, ts };
  }
  if (Object.keys(entries).length === 0) return null;
  return { v: 1, entries };
}

/** Build a full-state compaction snapshot from the merged map. Posting this and
 *  letting `foldChannelPrefs` apply the floor lets old deltas be GC'd. */
export function buildSnapshot(
  merged: Map<string, MergedPref>,
  ts: number = Date.now(),
): ChannelPrefsMessage {
  return { v: 1, snapshot: true, ts, entries: toSnapshotEntries(merged) };
}
