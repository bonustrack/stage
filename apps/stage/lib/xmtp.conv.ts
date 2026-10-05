import { classifyKeyPackageStatuses } from '@stage-labs/client/xmtp/clientErrors';
import { isSyncGroupName } from '@stage-labs/client/xmtp/readState';
import { convOfLine, sdk } from './xmtp.sdk';
import { channelConsent, loadHiddenChannels, setChannelHidden } from './hiddenChannels';
import { accountClient, type AccountClient } from './xmtp.account';
import { channelAccess, reconcileHiddenConsent, syncVisibleChannels, type GroupAccess } from './channelVisibility';
export type { GroupAccess } from './channelVisibility';
import { VISIBLE_CONSENT } from './xmtp.sdk.core';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { DmUnreachableReason, XmtpConsent } from './xmtp.types';
import { registerHiddenConv } from './xmtp.state.core';
import { patchRowConsent } from './channelsCache';
import { registerDmRoute, routeConvId } from './dmRoutes';
import { makeSharedSource } from './storeCore';
import { report, reported, recover } from './errorPolicy';
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

async function withoutDepartedGroups(context: AccountClient, convs: Conv[]): Promise<Conv[]> {
  const shown = await Promise.all(convs.map(async (conv) => {
    if (await conversationIsSyncGroup(conv)) { registerHiddenConv(conv.id); return false; }
    return await channelAccess(context, conv) !== 'outside';
  }));
  context.assertCurrent();
  return convs.filter((_, i) => shown[i]);
}

export async function listVisibleConversations(): Promise<Conv[]> {
  const context = await accountClient();
  await reconcileHiddenConsent(context);
  const hidden = await loadHiddenChannels(context.account.id);
  const visible = await sdk.listConvs(context.client, VISIBLE_CONSENT);
  return withoutDepartedGroups(context, visible.filter(c => !sdk.isGroup(c) || !hidden[c.id]?.hidden));
}

export async function syncConversationsFromNetwork(): Promise<void> {
  await syncVisibleChannels().catch(reported('xmtp.syncVisible'));
}

export async function groupAccessOf(convId: string): Promise<GroupAccess> {
  const context = await accountClient();
  const conv = await sdk.findConv(context.client, convId);
  return conv ? channelAccess(context, conv) : 'waiting';
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
    const consent = await sdk.consentOf(conv);
    return sdk.isGroup(conv) ? channelConsent(convId, consent) : consent;
  } catch (err) {
    report('xmtp.consentOf', err);
    return null;
  }
}

async function setConvConsent(convId: string, state: XmtpConsent): Promise<void> {
  const context = await accountClient();
  const conv = await sdk.findConv(context.client, convId);
  if (!conv) throw new Error('Conversation not found');
  context.assertCurrent();
  if (sdk.isGroup(conv)) {
    if (state === 'allowed' && await channelAccess(context, conv) !== 'member') throw new Error('Channel membership is not ready');
    await setChannelHidden(context.account.id, convId, state === 'denied');
    await reconcileHiddenConsent(context);
  } else {
    await sdk.setConsent(conv, state);
  }
  context.assertCurrent();
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
