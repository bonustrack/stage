
import {
  addGroupMembers, PublicIdentity, staticKeyPackageStatuses, type Conversation,
} from '@xmtp/react-native-sdk';
import { classifyKeyPackageStatuses } from '@stage-labs/client/xmtp/clientErrors';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine, xmtpClient, asConversationId } from './xmtp.client';
import { lineOfConv, type DmUnreachableReason, type XmtpConsent } from './xmtp.types';
import { conversationIsSyncGroup } from './xmtp.readSync';
import { withoutSyncGroups } from './xmtp.conv.core';
import { makeSharedSource } from './storeCore';

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(address, 'ETHEREUM'),
  );
  return dm.id;
}

interface ExistingDm { convId: string; peerJoined: boolean }

export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null> {
  const client = await xmtpClient();
  const identity = new PublicIdentity(address, 'ETHEREUM');
  let dm = await client.conversations.findDmByIdentity(identity);
  if (!dm) {
    await client.conversations.sync().catch(() => undefined);
    dm = await client.conversations.findDmByIdentity(identity);
  }
  if (!dm) return null;
  const members = await dm.members().catch(() => []);
  const peerInboxId = await client.findInboxIdFromIdentity(identity).catch(() => undefined);
  const peerJoined = members.length >= 2 || peerInboxId === client.inboxId;
  return { convId: dm.id, peerJoined };
}

export async function repairDmMembership(convId: string, address: string): Promise<boolean> {
  const client = await xmtpClient();
  const identity = new PublicIdentity(address, 'ETHEREUM');
  const peerInboxId = await client.findInboxIdFromIdentity(identity);
  if (peerInboxId === undefined || peerInboxId === '') return false;
  try {
    await addGroupMembers(
      client.installationId,
      asConversationId(convId),
      [peerInboxId],
    );
  } catch {
    return false;
  }
  const dm = await client.conversations.findDmByIdentity(identity);
  const members = await dm?.members().catch(() => []) ?? [];
  return members.length >= 2;
}

export async function dmUnreachableReason(address: string): Promise<DmUnreachableReason> {
  const client = await xmtpClient();
  const inboxId = await client.findInboxIdFromIdentity(new PublicIdentity(address, 'ETHEREUM'));
  if (inboxId === undefined || inboxId === '') return 'unregistered';
  const states = await client.inboxStates(true, [inboxId]);
  const installationIds = (states[0]?.installations ?? []).map(i => i.id) as Parameters<typeof staticKeyPackageStatuses>[1];
  if (installationIds.length === 0) return 'stale-installations';
  const { statuses } = await staticKeyPackageStatuses('production', installationIds);
  const verdict = classifyKeyPackageStatuses([...statuses.values()].map(s => s.validationError));
  return verdict === 'stale-installations' ? 'stale-installations' : null;
}

export async function listVisibleConversations(): Promise<Conversation[]> {
  const client = await xmtpClient();
  const convs = await client.conversations.list(undefined, undefined, ['allowed', 'unknown']);
  return withoutSyncGroups(convs, conversationIsSyncGroup);
}

export async function syncConversationsFromNetwork(): Promise<void> {
  const client = await xmtpClient();
  try {
    await client.conversations.syncAllConversations(['allowed', 'unknown']);
  } catch { }
}


export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return await conv.consentState();
  } catch {
    return null;
  }
}

async function setConvConsent(convId: string, state: XmtpConsent): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await conv.updateConsent(state);
}

export function acceptRequestConv(convId: string): Promise<void> { return setConvConsent(convId, 'allowed'); }

export function blockRequestConv(convId: string): Promise<void> { return setConvConsent(convId, 'denied'); }

export function unacceptConv(convId: string): Promise<void> { return setConvConsent(convId, 'unknown'); }

export function streamNewConversations(cb: (conv: Conversation) => void): () => void {
  const client = getCachedXmtpClient();
  if (!client) return () => undefined;
  let cancelled = false;
  void client.conversations.stream((conv) => { if (!cancelled) cb(conv); return Promise.resolve(); }).catch(() => undefined);
  return () => {
    cancelled = true;
    try { client.conversations.cancelStream(); } catch { }
  };
}

type ConsentClient = NonNullable<ReturnType<typeof getCachedXmtpClient>>;

const sharedConsent = makeSharedSource<ConsentClient>((client, emit) => {
  let live = true;
  void client.preferences.streamConsent(() => {
    if (live) emit();
    return Promise.resolve();
  }).catch(() => undefined);
  return () => {
    live = false;
    try { client.preferences.cancelStreamConsent(); } catch { }
  };
});

export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  return client ? sharedConsent(client, cb) : () => undefined;
}

export async function syncConsent(): Promise<void> {
  try {
    await getCachedXmtpClient()?.preferences.syncConsent();
  } catch { }
}
