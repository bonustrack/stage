import { describe, expect, mock, test } from 'bun:test';
import { collectSyncReplay } from '@stage-labs/client/xmtp/readState';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { XmtpConsent } from '../lib/xmtp.types';
import type { RowMessage } from '@stage-labs/client/xmtp/summarizeRow';
import { SYNC_CODECS } from '@stage-labs/client/xmtp/jsonCodecs';

const values = new Map<string, string>();
let activeId = 'web';
interface FakeConv { id: string; consent: XmtpConsent; group: boolean; active: boolean; name?: string; memberIds?: string[] }
const convs: FakeConv[] = [];
let beforePreferences: (() => void) | undefined;
let beforeConsent: (() => Promise<void>) | undefined;
let beforeInstallations: (() => Promise<void>) | undefined;
const presentDevices = new Map<string, string[]>();
const messages: RowMessage[] = [];
const sentTo: string[] = [];
const client = { inboxId: 'owner', preferences: { sync: async () => { beforePreferences?.(); } } };
const synced: string[] = [];
let storageFails = false;
let beforeFind: (() => Promise<void>) | undefined;
let beforeMembers: (() => Promise<void>) | undefined;
let connectedClient = client;
function withMethods(conv: FakeConv) {
  return Object.assign(conv, {
    members: async () => { await beforeMembers?.(); return (conv.memberIds ?? ['owner']).map(inboxId => ({ inboxId })); },
    sync: async () => { synced.push(conv.id); },
  });
}
let leaveFails = false;
let leaves = 0;
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { if (storageFails) throw new Error('disk full'); values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({ getActiveAccount: async () => ({ id: activeId, address: activeId }) }));
mock.module('../lib/xmtp.client', () => ({ cachedSelfEthAddress: () => activeId }));
mock.module('../lib/channelsCache', () => ({ getCachedRows: () => null, setCachedRows: () => undefined, patchRowConsent: () => undefined }));
mock.module('../modules/messaging/conversation', () => ({ groupRowMeta: async () => null }));
mock.module('../lib/xmtp.sdk', () => ({
  convOfLine: async (line: string) => {
    const conv = convs.find(c => line === lineOfConv(c.id));
    return conv ? withMethods(conv) : null;
  },
  sdk: {
    client: async () => connectedClient,
    cachedClient: () => connectedClient,
    findConv: async (_client: unknown, id: string) => {
      await beforeFind?.();
      const conv = convs.find(c => c.id === id);
      return conv ? withMethods(conv) : null;
    },
    isGroup: (conv: FakeConv) => conv.group,
    isActive: async (conv: FakeConv) => conv.active,
    groupName: async (conv: FakeConv) => conv.name,
    consentOf: async (conv: FakeConv) => conv.consent,
    setConsent: async (conv: FakeConv, consent: XmtpConsent) => { await beforeConsent?.(); conv.consent = consent; },
    send: { json: async (conv: FakeConv) => { sentTo.push(conv.id); return 'sent'; } },
    messages: async (_conv: FakeConv, opts: { afterNs?: number }) => messages.filter(m => m.sentNs > (opts.afterNs ?? 0)),
    rowOf: (message: RowMessage) => message,
    installationIdsOf: async () => ['first', 'second'],
    memberInstallationIds: async (conv: FakeConv) => { await beforeInstallations?.(); return presentDevices.get(conv.id) ?? ['first', 'second']; },
    leaveOp: () => async () => { leaves += 1; if (leaveFails) throw new Error('super-admin cannot leave'); },
    listConvs: async (_client: unknown, consent: XmtpConsent[]) => convs.filter(c => consent.includes(c.consent)).map(withMethods),
    syncVisible: async () => { synced.push(...convs.filter(c => c.consent !== 'denied').map(c => c.id)); },
  },
}));
const { bumpAccountEpoch } = await import('../lib/accountEpoch');
const { isChannelHidden, loadHiddenChannels, applyRemoteHiddenChannels, onHiddenChannelsChanged } = await import('../lib/hiddenChannels');
const { applyRemoteChatVisibility, backfillHiddenChannels, loadChatVisibility } = await import('../lib/chatVisibility');
const { leaveGroupConv } = await import('../lib/xmtp.groups');
const { listVisibleConversations, acceptRequestConv, getConvConsentState, groupAccessOf } = await import('../lib/xmtp.conv');
const { syncVisibleChannels, reconcileHiddenConsent, cachedChannelAccess, subscribeChannelAccess } = await import('../lib/channelVisibility');
const { visibleCachedRows } = await import('../lib/hiddenChannelsStorage');
const { accountClient } = await import('../lib/xmtp.account');
const { replaySyncGroups } = await import('../lib/readSyncReplay');
const { syncTarget, sendSyncState } = await import('../lib/syncTarget');
const { addOwnInstallationsToChats } = await import('../lib/ownInstallations');

async function switchAccount(id: string): Promise<void> {
  activeId = id;
  bumpAccountEpoch();
  await new Promise(resolve => { setTimeout(resolve, 0); });
}
const visible = async (): Promise<string[]> => (await listVisibleConversations()).map(c => c.id);

describe('departed channels across devices', () => {
  test('web leave persists, then an offline phone hides the still-active group on replay', async () => {
    const group: FakeConv = { id: 'departed', consent: 'allowed', group: true, active: true };
    const archive: FakeConv = { id: 'legitimate-archive', consent: 'allowed', group: true, active: false };
    convs.push(group, archive);
    const changes: string[] = [];
    const stop = onHiddenChannelsChanged(id => { changes.push(id); });
    expect(await leaveGroupConv(lineOfConv(group.id))).toBe('left');
    expect(leaves).toBe(1);
    expect(group.active).toBe(true);
    expect(await visible()).toEqual(['legitimate-archive']);
    const content = await loadChatVisibility('web');
    expect(changes).toEqual(['web']);
    stop();

    await switchAccount('phone');
    group.consent = 'allowed';
    expect(await visible()).toEqual(['departed', 'legitimate-archive']);
    const replay = collectSyncReplay([
      { contentTypeId: 'stage.box/clearState:1.0', content, sentNs: 1, senderInboxId: client.inboxId },
    ], 0, { inboxId: client.inboxId, nowMs: Date.now() });
    await applyRemoteChatVisibility('phone', replay);
    expect(await visible()).toEqual(['legitimate-archive']);
    expect(await getConvConsentState(group.id)).toBe('denied');
    group.active = false;
    group.consent = 'unknown';
    expect(await visible()).toEqual(['legitimate-archive']);
    expect(values.has('channels.hidden.phone')).toBe(true);
  });

  test('a refused leave hides the creator group without removing any membership', async () => {
    const group: FakeConv = { id: 'creator', consent: 'allowed', group: true, active: true };
    convs.push(group);
    leaveFails = true;
    expect(await leaveGroupConv(lineOfConv(group.id))).toBe('hidden');
    leaveFails = false;
    group.consent = 'allowed';
    expect(await visible()).not.toContain(group.id);
    expect(group.active).toBe(true);
  });

  test('migration hides old denied groups, not DMs or merely inactive archives', async () => {
    convs.push(
      { id: 'legacy', consent: 'denied', group: true, active: true },
      { id: 'blocked-dm', consent: 'denied', group: false, active: true },
      { id: 'sync', name: 'stage.sync:owner', consent: 'denied', group: true, active: true },
    );
    await backfillHiddenChannels('phone');
    const hidden = await loadHiddenChannels('phone');
    expect(hidden.legacy).toEqual({ hidden: true, at: 0 });
    expect(hidden['blocked-dm']).toBeUndefined();
    expect(hidden.sync).toBeUndefined();
    expect(hidden['legitimate-archive']).toBeUndefined();
  });

  test('an explicit approval after rejoining beats old leave snapshots and stale denied consent', async () => {
    const group = convs.find(c => c.id === 'departed');
    if (!group) throw new Error('missing fixture');
    group.active = true;
    group.consent = 'unknown';
    const old = await loadHiddenChannels('phone');
    await acceptRequestConv(group.id);
    await applyRemoteHiddenChannels('phone', old);
    group.consent = 'denied';
    await backfillHiddenChannels('phone');
    expect(await visible()).toContain(group.id);
    expect(await getConvConsentState(group.id)).toBe('allowed');
    expect(group.consent).toBe('allowed');
    expect(synced).toContain(group.id);
  });

  test('a delayed replay only writes its own account, and a restart loads its saved marker', async () => {
    await switchAccount('other-account');
    await applyRemoteHiddenChannels('phone', { delayed: { hidden: true, at: 10 } });
    expect(isChannelHidden('delayed')).toBe(false);
    expect(await loadHiddenChannels('other-account')).toEqual({});
    await switchAccount('phone');
    expect(isChannelHidden('delayed')).toBe(true);
    expect(isChannelHidden('creator')).toBe(true);
    expect(await loadHiddenChannels('web')).toHaveProperty('departed');
  });

  test('a failed durable write rejects replay and the identical snapshot can be retried', async () => {
    storageFails = true;
    const state = { unwritten: { hidden: true, at: 20 } };
    await expect(applyRemoteHiddenChannels('phone', state)).rejects.toThrow('disk full');
    expect(isChannelHidden('unwritten')).toBe(false);
    storageFails = false;
    await applyRemoteHiddenChannels('phone', state);
    expect(JSON.parse(values.get('channels.hidden.phone') ?? '{}').unwritten).toEqual(state.unwritten);
  });

  test('concurrent delayed writes preserve both changes on an inactive account', async () => {
    await switchAccount('other-account');
    await Promise.all([
      applyRemoteHiddenChannels('phone', { concurrentA: { hidden: true, at: 30 } }),
      applyRemoteHiddenChannels('phone', { concurrentB: { hidden: false, at: 40 } }),
    ]);
    const saved = await loadHiddenChannels('phone');
    expect(saved.concurrentA?.hidden).toBe(true);
    expect(saved.concurrentB?.hidden).toBe(false);
    expect(isChannelHidden('concurrentA')).toBe(false);
  });

  test('an account switch during lookup aborts leave without touching either membership', async () => {
    await switchAccount('web');
    beforeFind = async () => { beforeFind = undefined; await switchAccount('other-account'); };
    const before = leaves;
    await expect(leaveGroupConv(lineOfConv('creator'))).rejects.toThrow('Messaging account changed');
    expect(leaves).toBe(before);
    expect(await loadHiddenChannels('other-account')).toEqual({});
    await expect(backfillHiddenChannels('web')).rejects.toThrow('Messaging account changed');
  });

  test('known nonmembers are absent, while incomplete and inactive own archives are retained', async () => {
    convs.push(
      { id: 'removed', group: true, active: false, consent: 'allowed', memberIds: ['another-inbox'] },
      { id: 'incomplete', group: true, active: false, consent: 'allowed', memberIds: [] },
    );
    expect(await visible()).not.toContain('removed');
    expect(await visible()).toContain('incomplete');
    expect(await visible()).toContain('legitimate-archive');
    expect(await groupAccessOf('removed')).toBe('outside');
    expect(await groupAccessOf('incomplete')).toBe('checking');
    expect(await groupAccessOf('legitimate-archive')).toBe('waiting');
  });

  test('listing seeds immediate access from SDK membership, not consent or another channel', async () => {
    const group: FakeConv = { id: 'cached-member', group: true, active: true, consent: 'allowed' };
    convs.push(group);
    expect(cachedChannelAccess(group.id)).toBe('checking');
    await visible();
    expect(cachedChannelAccess(group.id)).toBe('member');
    expect(cachedChannelAccess('removed')).toBe('outside');
    expect(cachedChannelAccess('incomplete')).toBe('checking');
    expect(cachedChannelAccess('legitimate-archive')).toBe('waiting');
    expect(cachedChannelAccess('never-checked')).toBe('checking');
    const changes: string[] = [];
    const stop = subscribeChannelAccess(() => { changes.push(cachedChannelAccess(group.id)); });
    group.memberIds = ['someone-else'];
    await groupAccessOf(group.id);
    expect(changes).toEqual(['outside']);
    stop();
    group.memberIds = ['owner'];
  });

  test('access does not cross accounts, client replacement or stale async completion', async () => {
    await groupAccessOf('cached-member');
    expect(cachedChannelAccess('cached-member')).toBe('member');
    connectedClient = { ...client };
    expect(cachedChannelAccess('cached-member')).toBe('checking');
    await groupAccessOf('cached-member');
    expect(cachedChannelAccess('cached-member')).toBe('member');
    await switchAccount('cache-other');
    expect(cachedChannelAccess('cached-member')).toBe('checking');
    beforeMembers = async () => { beforeMembers = undefined; await switchAccount('cache-latest'); };
    await expect(groupAccessOf('cached-member')).rejects.toThrow('Messaging account changed');
    expect(cachedChannelAccess('cached-member')).toBe('checking');
    await switchAccount('other-account');
    expect(cachedChannelAccess('cached-member')).toBe('checking');
  });

  test('failed or missing membership clears a previous member without claiming device waiting', async () => {
    await groupAccessOf('cached-member');
    beforeMembers = async () => { beforeMembers = undefined; throw new Error('membership unavailable'); };
    expect(await groupAccessOf('cached-member')).toBe('checking');
    expect(cachedChannelAccess('cached-member')).toBe('checking');
    await groupAccessOf('cached-member');
    const index = convs.findIndex(c => c.id === 'cached-member');
    convs.splice(index, 1);
    expect(await groupAccessOf('cached-member')).toBe('checking');
    expect(cachedChannelAccess('cached-member')).toBe('checking');
  });

  test('transport consent and cached rows obey durable hidden state before synchronization', async () => {
    await switchAccount('phone');
    const creator = convs.find(c => c.id === 'creator');
    if (!creator) throw new Error('missing fixture');
    creator.consent = 'allowed';
    synced.length = 0;
    await syncVisibleChannels();
    expect(creator.consent).toBe('denied');
    expect(synced).not.toContain('creator');
    expect(synced).toContain('departed');
    const rows = [{ convId: 'creator', peerAddress: null }, { convId: 'departed', peerAddress: null }];
    expect(await visibleCachedRows('phone', rows)).toEqual([rows[1]]);
  });

  test('backfill reads legacy denials delivered by preference sync', async () => {
    const group: FakeConv = { id: 'late-denial', consent: 'allowed', group: true, active: true };
    convs.push(group);
    beforePreferences = () => { group.consent = 'denied'; };
    await backfillHiddenChannels('phone');
    beforePreferences = undefined;
    expect((await loadHiddenChannels('phone'))[group.id]).toEqual({ hidden: true, at: 0 });
  });

  test('a newer approval during reconciliation wins and syncs the quiet restored channel', async () => {
    const group: FakeConv = { id: 'racing', consent: 'allowed', group: true, active: true };
    convs.push(group);
    await applyRemoteHiddenChannels('phone', { racing: { hidden: true, at: 50 } });
    beforeConsent = async () => {
      beforeConsent = undefined;
      await applyRemoteHiddenChannels('phone', { racing: { hidden: false, at: 60 } });
    };
    synced.length = 0;
    await reconcileHiddenConsent(await accountClient());
    expect(group.consent).toBe('allowed');
    expect(synced).toContain('racing');
    expect(isChannelHidden('racing')).toBe(false);
  });

  test('known outsiders cannot be approved through the action API', async () => {
    await expect(acceptRequestConv('removed')).rejects.toThrow('Channel membership is not ready');
    expect((await loadHiddenChannels('phone')).removed).toBeUndefined();
  });

  test('repair rechecks hidden state and invalidates its completion when visibility changes', async () => {
    const group: FakeConv = { id: 'repair-later', consent: 'allowed', group: true, active: true };
    convs.push(group);
    presentDevices.set(group.id, ['first']);
    beforeInstallations = async () => {
      beforeInstallations = undefined;
      await applyRemoteHiddenChannels('phone', { [group.id]: { hidden: true, at: 70 } });
    };
    synced.length = 0;
    await addOwnInstallationsToChats('phone');
    expect(synced).not.toContain(group.id);
    expect(values.has('ownInstallations.done.phone')).toBe(false);
    await addOwnInstallationsToChats('phone');
    const hiddenSignature = values.get('ownInstallations.done.phone');
    expect(hiddenSignature).toBeDefined();
    await applyRemoteHiddenChannels('phone', { [group.id]: { hidden: false, at: 80 } });
    await addOwnInstallationsToChats('phone');
    expect(synced).toContain(group.id);
    expect(values.get('ownInstallations.done.phone')).not.toBe(hiddenSignature);
    presentDevices.delete(group.id);
  });

  test('failed repair queries do not mark missing installations as repaired', async () => {
    values.delete('ownInstallations.done.phone');
    beforeInstallations = async () => { beforeInstallations = undefined; throw new Error('offline'); };
    await expect(addOwnInstallationsToChats('phone')).rejects.toThrow('offline');
    expect(values.has('ownInstallations.done.phone')).toBe(false);
    await addOwnInstallationsToChats('phone');
    expect(values.has('ownInstallations.done.phone')).toBe(true);
  });

  test('an old cursor does not skip hidden snapshots and a failed write does not acknowledge replay', async () => {
    convs.push({ id: 'replay-group', consent: 'allowed', group: true, active: true });
    values.set('readSync.cursor.v2.phone.replay-group', '1000');
    messages.push({
      contentTypeId: 'stage.box/clearState:1.0', senderInboxId: 'owner', sentNs: 100,
      content: { cleared: {}, hidden: { replayed: { hidden: true, at: 90 } } },
    });
    const context = await accountClient();
    const groups = [{ id: 'replay-group', active: true, createdAtNs: 1 }];
    const replay = (): Promise<void> => replaySyncGroups(context, 'replay-group', groups,
      state => applyRemoteChatVisibility('phone', state), () => undefined);
    storageFails = true;
    await expect(replay()).rejects.toThrow('disk full');
    expect(values.has('readSync.cursor.v3.phone.replay-group')).toBe(false);
    storageFails = false;
    await replay();
    expect(isChannelHidden('replayed')).toBe(true);
    expect(values.get('readSync.cursor.v3.phone.replay-group')).toBe('100');
    messages.length = 0;
  });

  test('a captured sync target cannot publish through another account after an await', async () => {
    const context = await accountClient();
    const target = await syncTarget(context, 'replay-group');
    await sendSyncState(target, SYNC_CODECS.clear, { cleared: {} });
    expect(sentTo).toEqual(['replay-group']);
    await switchAccount('other-account');
    expect(() => sendSyncState(target, SYNC_CODECS.clear, { cleared: {} })).toThrow('Messaging account changed');
    expect(sentTo).toEqual(['replay-group']);
  });
});
