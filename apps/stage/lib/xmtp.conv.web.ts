
import {
  ConsentState, ConsentEntityType, IdentifierKind,
  type Consent, type Conversation,
} from '@xmtp/browser-sdk';
import { classifyKeyPackageStatuses } from '@stage-labs/client/xmtp/clientErrors';
import { consentStateToString } from '@stage-labs/client/xmtp/consent';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine, xmtpClient } from './xmtp.client.web';
import { lineOfConv, type DmUnreachableReason, type XmtpConsent } from './xmtp.types';
import { conversationIsSyncGroup } from './xmtp.readSync.web';
import { registerHiddenConv } from './readSyncRegistry';

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.createDmWithIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  return dm.id;
}

export interface ExistingDm { convId: string; peerJoined: boolean }

export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null> {
  const client = await xmtpClient();
  const inboxId = await client.fetchInboxIdByIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  if (inboxId === undefined || inboxId === '') return null;
  let dm = await client.conversations.getDmByInboxId(inboxId);
  if (!dm) {
    await client.conversations.sync().catch(() => undefined);
    dm = await client.conversations.getDmByInboxId(inboxId);
  }
  if (!dm) return null;
  const members = await dm.members().catch(() => []);
  const peerJoined = members.length >= 2 || inboxId === client.inboxId;
  return { convId: dm.id, peerJoined };
}

export function repairDmMembership(convId: string, address: string): Promise<boolean> {
  void convId;
  void address;
  return Promise.resolve(false);
}

export async function dmUnreachableReason(address: string): Promise<DmUnreachableReason> {
  const client = await xmtpClient();
  const inboxId = await client.fetchInboxIdByIdentifier({
    identifier: address.toLowerCase(),
    identifierKind: IdentifierKind.Ethereum,
  });
  if (inboxId === undefined || inboxId === '') return 'unregistered';
  const states = await client.preferences.fetchInboxStates([inboxId]);
  const installationIds = (states[0]?.installations ?? []).map(i => i.id);
  if (installationIds.length === 0) return 'stale-installations';
  const statuses = await client.fetchKeyPackageStatuses(installationIds);
  const verdict = classifyKeyPackageStatuses([...statuses.values()].map(s => s.validationError));
  return verdict === 'stale-installations' ? 'stale-installations' : null;
}

async function withoutSyncGroups(convs: Conversation[]): Promise<Conversation[]> {
  const flags = await Promise.all(convs.map((c) => conversationIsSyncGroup(c).catch(() => false)));
  return convs.filter((c, i) => {
    if (flags[i] === true) registerHiddenConv(c.id);
    return flags[i] !== true;
  });
}

export async function listVisibleConversations(): Promise<Conversation[]> {
  const client = await xmtpClient();
  const convs = await client.conversations
    .list({ consentStates: [ConsentState.Allowed, ConsentState.Unknown] })
    .catch(() => []);
  return withoutSyncGroups(convs);
}

export async function syncConversationsFromNetwork(): Promise<void> {
  const client = await xmtpClient();
  try {
    await client.conversations.syncAll([ConsentState.Allowed, ConsentState.Unknown]);
  } catch { }
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

async function setConvConsent(convId: string, state: ConsentState): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsentState(state);
}

export function acceptRequestConv(convId: string): Promise<void> { return setConvConsent(convId, ConsentState.Allowed); }

export function blockRequestConv(convId: string): Promise<void> { return setConvConsent(convId, ConsentState.Denied); }

export function unacceptConv(convId: string): Promise<void> { return setConvConsent(convId, ConsentState.Unknown); }

interface StreamHandle { end: () => Promise<unknown> }

function endWhenCancelled<T extends StreamHandle>(start: Promise<T>): () => void {
  let handle: StreamHandle | null = null;
  let cancelled = false;
  start.then((stream) => {
    if (cancelled) { void stream.end().catch(() => undefined); return; }
    handle = stream;
  }).catch(() => undefined);
  return () => {
    cancelled = true;
    if (handle) void handle.end().catch(() => undefined);
  };
}

export function streamNewConversations(cb: (conv: Conversation) => void): () => void {
  const client = getCachedXmtpClient();
  if (!client) return () => undefined;
  return endWhenCancelled(client.conversations.stream({ onValue: cb, onError: () => undefined }));
}

export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  if (!client) return () => undefined;
  return endWhenCancelled(client.preferences.streamConsent({
    onValue: (records: Consent[]) => {
      if (records.some(c => c.entityType === ConsentEntityType.GroupId)) cb();
    },
    onError: () => undefined,
  }));
}

export async function syncConsent(): Promise<void> {
  try {
    await getCachedXmtpClient()?.preferences.sync();
  } catch { }
}
