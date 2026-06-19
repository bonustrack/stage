/** Cross-device read/unread markers + per-conv last-read tracking. Split out of
 *  `xmtp.ts` so each file stays under the lint cap; re-exported from there. */

import {
  ConsentState,
  ConsentEntityType,
  type Consent,
} from '@xmtp/browser-sdk';
import { getCachedXmtpClient, convOfLine, lineOfConv } from './xmtp';

/** Per-conv "last read at" timestamp in XMTP `sentAtNs` units (number, not
 *  bigint — we coerce on read/write). Persisted under `unread.lastRead.<id>`
 *  in localStorage so unread counts survive a reload. */
const LAST_READ_PREFIX = 'unread.lastRead.';
/** Read a conversation's persisted last-read timestamp in sentAtNs units. */
export function getLastReadNs(convId: string): number {
  const raw = localStorage.getItem(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
/** Persist a conversation's last-read timestamp in sentAtNs units to localStorage. */
export function setLastReadNs(convId: string, ns: number): void {
  try { localStorage.setItem(LAST_READ_PREFIX + convId, String(ns)); }
  catch { /* quota / private-mode — best effort */ }
}

/** Cross-device read/unread marker — synced across the inbox's installations via
 *  XMTP's per-conversation consent state. See the matching block in
 *  apps/app/lib/xmtp.ts for the full rationale: XMTP V3 has no arbitrary synced
 *  KV store, so we repurpose the consent `allowed`↔`unknown` axis as a synced
 *  read flag (never `denied`, which would hide the conversation):
 *    - `allowed` → read
 *    - `unknown` → unread
 *  The numeric unread *count* stays per-device (lastReadNs); the binary
 *  read/unread state propagates cross-device. */

/** Map an XMTP `ConsentState` enum to its string form used across the UI. */
function consentStateToString(s: ConsentState): 'allowed' | 'denied' | 'unknown' {
  return s === ConsentState.Allowed ? 'allowed'
    : s === ConsentState.Denied ? 'denied' : 'unknown';
}

/** Read a conversation's synced consent state as a string. */
export async function getConvConsent(convId: string): Promise<'allowed' | 'denied' | 'unknown'> {
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return 'unknown';
    return consentStateToString(await conv.consentState());
  } catch { return 'unknown'; }
}

/** Mark a conversation read across devices: consent → Allowed (synced) + bump
 *  the local lastReadNs so the per-device count clears too. */
export async function markConvReadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, Date.now() * 1_000_000);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Allowed) {
      await conv.updateConsentState(ConsentState.Allowed);
    }
  } catch { /* best-effort — local lastReadNs still cleared the badge */ }
}

/** Mark a conversation unread across devices: consent → Unknown (synced) +
 *  rewind the local lastReadNs so this device shows the badge immediately. */
export async function markConvUnreadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, 0);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Unknown) {
      await conv.updateConsentState(ConsentState.Unknown);
    }
  } catch { /* best-effort */ }
}

/** Pull synced preference/consent updates from the network into the local DB.
 *  Call on mount / tab-visible so consent changes from another device land. */
export async function syncPreferences(): Promise<void> {
  try { await getCachedXmtpClient()?.preferences.sync(); }
  catch { /* best-effort */ }
}

/** Subscribe to cross-device consent changes. Fires `(convId, state)` for every
 *  conversation-scoped consent update. Returns a stop fn. */
export async function streamConvConsent(
  onChange: (convId: string, state: 'allowed' | 'denied' | 'unknown') => void,
): Promise<() => Promise<void>> {
  const client = getCachedXmtpClient();
  if (!client) return () => Promise.resolve();
  const stream = await client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      for (const c of records) {
        if (c.entityType !== ConsentEntityType.GroupId) continue;
        onChange(c.entity, consentStateToString(c.state));
      }
    },
    onError: () => { /* backstops resync */ },
  });
  return async () => { try { await stream.end(); } catch { /* ignore */ } };
}
