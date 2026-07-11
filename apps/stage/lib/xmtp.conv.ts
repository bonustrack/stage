
import {
  addGroupMembers, PublicIdentity, staticKeyPackageStatuses, type Conversation,
} from '@xmtp/react-native-sdk';
import { classifyKeyPackageStatuses } from '@stage-labs/client/xmtp/clientErrors';
import { getCachedXmtpClient, getOrCreateXmtpClient, convOfLine } from './xmtp.client';
import { lineOfConv, type DmUnreachableReason, type XmtpConsent } from './xmtp.types';

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await getOrCreateXmtpClient('production');
  const dm = await client.conversations.findOrCreateDmWithIdentity(
    new PublicIdentity(address, 'ETHEREUM'),
  );
  return dm.id;
}

export interface ExistingDm { convId: string; peerJoined: boolean }

export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
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
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const identity = new PublicIdentity(address, 'ETHEREUM');
  const peerInboxId = await client.findInboxIdFromIdentity(identity);
  if (peerInboxId === undefined || peerInboxId === '') return false;
  try {
    await addGroupMembers(
      client.installationId,
      convId as unknown as Parameters<typeof addGroupMembers>[1],
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
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  const inboxId = await client.findInboxIdFromIdentity(new PublicIdentity(address, 'ETHEREUM'));
  if (inboxId === undefined || inboxId === '') return 'unregistered';
  const states = await client.inboxStates(true, [inboxId]);
  const installationIds = (states[0]?.installations ?? []).map(i => i.id) as Parameters<typeof staticKeyPackageStatuses>[1];
  if (installationIds.length === 0) return 'stale-installations';
  const { statuses } = await staticKeyPackageStatuses('production', installationIds);
  const verdict = classifyKeyPackageStatuses([...statuses.values()].map(s => s.validationError));
  return verdict === 'stale-installations' ? 'stale-installations' : null;
}

export async function listRequestConvs(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAllConversations(['unknown']);
  } catch { }
  return client.conversations.list(undefined, undefined, ['unknown']).catch(() => []);
}

export async function syncAllowedConversations(): Promise<Conversation[]> {
  const client = getCachedXmtpClient() ?? await getOrCreateXmtpClient('production');
  try {
    await client.conversations.syncAllConversations(['allowed', 'unknown']);
  } catch { }
  return client.conversations.list(undefined, undefined, ['allowed']).catch(() => []);
}

export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return await (conv as unknown as { consentState: () => Promise<XmtpConsent> }).consentState();
  } catch {
    return null;
  }
}

export async function acceptRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('allowed');
}

export async function blockRequestConv(convId: string): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await (conv as unknown as { updateConsent: (s: XmtpConsent) => Promise<void> }).updateConsent('denied');
}

export function streamConvConsent(cb: () => void): () => void {
  const client = getCachedXmtpClient();
  const prefs = (client as unknown as {
    preferences?: { streamConsent?: (h: () => void) => Promise<{ end?: () => void } | (() => void)>; };
  })?.preferences;
  if (!prefs?.streamConsent) return () => undefined;
  let canceller: (() => void) | null = null;
  let cancelled = false;
  void prefs.streamConsent(() => { cb(); }).then(sub => {
    const stop = () => {
      const end = (sub as { end?: () => void }).end;
      if (typeof end === 'function') end.call(sub);
      else if (typeof sub === 'function') (sub)();
    };
    if (cancelled) { try { stop(); } catch { } return; }
    canceller = () => { try { stop(); } catch { } };
  }).catch(() => undefined);
  return () => { cancelled = true; canceller?.(); };
}

export async function syncConsent(): Promise<void> {
  try {
    const client = getCachedXmtpClient();
    await (client as unknown as { preferences?: { syncConsent?: () => Promise<unknown> } })?.preferences?.syncConsent?.();
  } catch { }
}
