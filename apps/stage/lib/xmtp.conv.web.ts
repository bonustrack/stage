
import {
  ConsentState, ConsentEntityType, IdentifierKind,
  type Consent, type Conversation,
} from '@xmtp/browser-sdk';
import { consentStateToString } from '@stage-labs/client/xmtp/consent';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client.web';
import { lineOfConv, type XmtpConsent } from './xmtp.types';

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}

export async function listRequestConvs(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAll([ConsentState.Unknown]);
  } catch { }
  return client.conversations.list({ consentStates: [ConsentState.Unknown] }).catch(() => []);
}

export async function syncAllowedConversations(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
  } catch { }
  return client.conversations
    .list({ consentStates: [ConsentState.Allowed] })
    .catch(() => []);
}

export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return consentStateToString(await conv.consentState());
  } catch {
    return null;
  }
}

export async function acceptRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsentState(ConsentState.Allowed);
}

export async function blockRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsentState(ConsentState.Denied);
}

interface ConsentStreamHandle { end: () => Promise<unknown> }

export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  if (!client) return () => undefined;
  let handle: ConsentStreamHandle | null = null;
  let cancelled = false;
  void client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      if (records.some(c => c.entityType === ConsentEntityType.GroupId)) cb();
    },
    onError: () => undefined,
  }).then((stream) => {
    if (cancelled) { void stream.end().catch(() => undefined); return; }
    handle = stream;
  }).catch(() => undefined);
  return () => {
    cancelled = true;
    if (handle) void handle.end().catch(() => undefined);
  };
}

export async function syncConsent(): Promise<void> {
  try {
    await getCachedXmtpClient()?.preferences.sync();
  } catch { }
}
