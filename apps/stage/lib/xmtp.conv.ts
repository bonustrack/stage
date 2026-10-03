import { classifyKeyPackageStatuses } from '@stage-labs/client/xmtp/clientErrors';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { convOfLine, sdk } from './xmtp.sdk';
import { VISIBLE_CONSENT } from './xmtp.sdk.core';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { DmUnreachableReason, XmtpConsent } from './xmtp.types';
import { registerHiddenConv } from './xmtp.state.core';
import { patchRowConsent } from './channelsCache';
import { registerDmRoute, routeConvId } from './dmRoutes';
import { makeSharedSource } from './storeCore';
import { ignored, report, reported, recover } from './errorPolicy';
import { runSyncCheck, type SyncCheckResult } from './syncCheck.model';

type Conv = NonNullable<Awaited<ReturnType<typeof convOfLine>>>;
type ConvClient = Awaited<ReturnType<typeof sdk.client>>;

export function createdBySelf(conv: Conv, selfInboxId: string): boolean {
  return selfInboxId !== '' && sdk.addedByInboxId(conv) === selfInboxId;
}

export async function conversationIsSyncGroup(conv: Conv): Promise<boolean> {
  return isSyncGroupName(await sdk.groupName(conv));
}

async function shownDmId(client: ConvClient, dmId: string): Promise<string> {
  const shown = await sdk.findConv(client, dmId).catch(recover('xmtp.shownDm', null));
  if (shown && shown.id !== dmId) registerDmRoute(dmId, shown.id);
  return routeConvId(shown?.id ?? dmId);
}

export async function rowIdOfConv(convId: string): Promise<string> {
  const shown = await sdk.findConv(await sdk.client(), convId).catch(recover('xmtp.rowIdOfConv', null));
  return routeConvId(shown?.id ?? convId);
}

export async function openDmWithAddress(address: string): Promise<string> {
  const client = await sdk.client();
  const dm = await sdk.openDm(client, address);
  return shownDmId(client, dm.id);
}

interface ExistingDm { convId: string; peerJoined: boolean }

export async function findExistingDmWithAddress(address: string): Promise<ExistingDm | null> {
  const client = await sdk.client();
  const lookup = await sdk.dmLookup(client, address);
  if (!lookup) return null;
  let dm = await lookup.find();
  if (!dm) {
    await sdk.syncConvList(client).catch(reported('xmtp.syncConvList'));
    dm = await lookup.find();
  }
  if (!dm) return null;
  const members = await dm.members().catch(recover('xmtp.dmMembers', []));
  const peerInboxId = await lookup.peerInboxId().catch(recover('xmtp.dmPeer', undefined));
  const peerJoined = members.length >= 2 || peerInboxId === client.inboxId;
  return { convId: routeConvId(dm.id), peerJoined };
}

export async function repairDmMembership(convId: string, address: string): Promise<boolean> {
  const forceAddMember = sdk.forceAddMember;
  if (!forceAddMember) return false;
  const client = await sdk.client();
  const peerInboxId = await sdk.inboxIdOfAddress(client, address);
  if (peerInboxId === undefined || peerInboxId === '') return false;
  try {
    await forceAddMember(client, convId, peerInboxId);
  } catch (err) {
    report('xmtp.repairDm', err);
    return false;
  }
  const dm = await (await sdk.dmLookup(client, address))?.find();
  const members = await dm?.members().catch(recover('xmtp.dmMembers', [])) ?? [];
  return members.length >= 2;
}

export async function dmUnreachableReason(address: string): Promise<DmUnreachableReason> {
  const client = await sdk.client();
  const inboxId = await sdk.inboxIdOfAddress(client, address);
  if (inboxId === undefined || inboxId === '') return 'unregistered';
  const installationIds = await sdk.installationIdsOf(client, inboxId);
  if (installationIds.length === 0) return 'stale-installations';
  const verdict = classifyKeyPackageStatuses(await sdk.keyPackageErrors(client, installationIds));
  return verdict === 'stale-installations' ? 'stale-installations' : null;
}

async function withoutSyncGroups(convs: Conv[]): Promise<Conv[]> {
  const flags = await Promise.all(convs.map((c) => conversationIsSyncGroup(c).catch(recover('xmtp.syncGroupCheck', false))));
  return convs.filter((c, i) => {
    if (flags[i] === true) registerHiddenConv(c.id);
    return flags[i] !== true;
  });
}

export async function listVisibleConversations(): Promise<Conv[]> {
  const client = await sdk.client();
  return withoutSyncGroups(await sdk.listConvs(client, VISIBLE_CONSENT));
}

export async function syncConversationsFromNetwork(): Promise<void> {
  const client = await sdk.client();
  try {
    await sdk.syncVisible(client);
  } catch (err) {
    report('xmtp.syncVisible', err);
  }
}

export type GroupAccess = 'member' | 'waiting' | 'outside';

export async function groupAccessOf(convId: string): Promise<GroupAccess> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv || !sdk.isGroup(conv) || await sdk.isActive(conv)) return 'member';
  const [client, members] = await Promise.all([
    sdk.client(), conv.members().catch(ignored([], 'probe')),
  ]);
  const memberListKnown = members.length > 0;
  return memberListKnown && !members.some(m => m.inboxId === client.inboxId) ? 'outside' : 'waiting';
}

export async function checkConvSync(convId: string): Promise<SyncCheckResult> {
  const client = sdk.cachedClient();
  if (!client) return { ok: false, title: 'Messaging not ready', message: 'The messaging client has not finished opening on this device.' };
  return runSyncCheck({
    find: () => sdk.findConv(client, convId),
    isActive: sdk.isActive,
    sync: (conv) => conv.sync(),
    syncInvites: () => sdk.syncConvList(client),
    nativeError: sdk.nativeErrorLog,
    device: client.installationId.slice(0, 8),
    details: async (conv) => {
      const [state, latest] = await Promise.all([
        sdk.syncState(conv), sdk.messages(conv, { limit: 1, order: 'desc' }),
      ]);
      const newestMs = latest[0] ? sdk.sentNsOf(latest[0]) / 1_000_000 : 0;
      return { state, newest: newestMs > 0 ? new Date(newestMs).toLocaleString() : '' };
    },
  });
}

export async function getConvConsentState(convId: string): Promise<XmtpConsent | null> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) return null;
  try {
    return await sdk.consentOf(conv);
  } catch (err) {
    report('xmtp.consentOf', err);
    return null;
  }
}

async function setConvConsent(convId: string, state: XmtpConsent): Promise<void> {
  const conv = await convOfLine(lineOfConv(convId));
  if (!conv) throw new Error('Conversation not found');
  await sdk.setConsent(conv, state);
  patchRowConsent(convId, state);
}

export function acceptRequestConv(convId: string): Promise<void> { return setConvConsent(convId, 'allowed'); }

export function blockRequestConv(convId: string): Promise<void> { return setConvConsent(convId, 'denied'); }

export function unacceptConv(convId: string): Promise<void> { return setConvConsent(convId, 'unknown'); }

const sharedConversations = makeSharedSource<ConvClient, Conv>(sdk.streamConversations);

export function streamNewConversations(cb: (conv: Conv) => void): () => void {
  const client = sdk.cachedClient();
  return client ? sharedConversations(client, cb) : () => undefined;
}

const sharedConsent = makeSharedSource<ConvClient>((client, emit) => sdk.streamConsent(client, () => { emit(); }));

export function streamConvConsent(cb: () => void): () => void {
  const client = sdk.cachedClient();
  return client ? sharedConsent(client, cb) : () => undefined;
}

export async function syncConsent(): Promise<void> {
  try {
    const client = sdk.cachedClient();
    if (client) await sdk.syncConsent(client);
  } catch (err) {
    report('xmtp.syncConsent', err);
  }
}
