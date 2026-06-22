
import {
  ConsentState,
  ConsentEntityType,
  type Consent,
} from '@xmtp/browser-sdk';
import { getCachedXmtpClient, convOfLine, lineOfConv } from './xmtp';
import { type XmtpConsent, consentStateToString } from '@stage-labs/client/xmtp/consent';

const LAST_READ_PREFIX = 'unread.lastRead.';
export function getLastReadNs(convId: string): number {
  const raw = localStorage.getItem(LAST_READ_PREFIX + convId);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}
export function setLastReadNs(convId: string, ns: number): void {
  try { localStorage.setItem(LAST_READ_PREFIX + convId, String(ns)); }
  catch { }
}


export async function getConvConsent(convId: string): Promise<XmtpConsent> {
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (!conv) return 'unknown';
    return consentStateToString(await conv.consentState());
  } catch { return 'unknown'; }
}

export async function markConvReadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, Date.now() * 1_000_000);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Allowed) {
      await conv.updateConsentState(ConsentState.Allowed);
    }
  } catch { }
}

export async function markConvUnreadSynced(convId: string): Promise<void> {
  setLastReadNs(convId, 0);
  try {
    const conv = await convOfLine(lineOfConv(convId));
    if (conv && (await conv.consentState()) !== ConsentState.Unknown) {
      await conv.updateConsentState(ConsentState.Unknown);
    }
  } catch { }
}

export async function syncPreferences(): Promise<void> {
  try { await getCachedXmtpClient()?.preferences.sync(); }
  catch { }
}

export async function streamConvConsent(
  onChange: (convId: string, state: XmtpConsent) => void,
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
    onError: () => undefined,
  });
  return async () => { try { await stream.end(); } catch { } };
}
