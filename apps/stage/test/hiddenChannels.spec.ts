import { describe, expect, mock, test } from 'bun:test';
import { collectSyncReplay } from '@stage-labs/client/xmtp/readState';
import { lineOfConv } from '@stage-labs/client/xmtp/line';
import type { XmtpConsent } from '../lib/xmtp.types';

const values = new Map<string, string>();
let activeId = 'web';
interface FakeConv { id: string; consent: XmtpConsent; group: boolean; active: boolean; name?: string }
const convs: FakeConv[] = [];
const client = { inboxId: 'owner' };
let leaveFails = false;
let leaves = 0;
mock.module('../platform/storage', () => ({
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({ getActiveAccount: async () => ({ id: activeId }) }));
mock.module('../lib/channelsCache', () => ({ getCachedRows: () => null, setCachedRows: () => undefined, patchRowConsent: () => undefined }));
mock.module('../modules/messaging/conversation', () => ({ groupRowMeta: async () => null }));
mock.module('../lib/xmtp.sdk', () => ({
  convOfLine: async (line: string) => convs.find(c => line === lineOfConv(c.id)) ?? null,
  sdk: {
    client: async () => client,
    cachedClient: () => client,
    isGroup: (conv: FakeConv) => conv.group,
    isActive: async (conv: FakeConv) => conv.active,
    groupName: async (conv: FakeConv) => conv.name,
    consentOf: async (conv: FakeConv) => conv.consent,
    setConsent: async (conv: FakeConv, consent: XmtpConsent) => { conv.consent = consent; },
    leaveOp: () => async () => { leaves += 1; if (leaveFails) throw new Error('super-admin cannot leave'); },
    listConvs: async (_client: unknown, consent: XmtpConsent[]) => convs.filter(c => consent.includes(c.consent)),
  },
}));
const { bumpAccountEpoch } = await import('../lib/accountEpoch');
const { isChannelHidden, loadHiddenChannels, applyRemoteHiddenChannels, onHiddenChannelsChanged } = await import('../lib/hiddenChannels');
const { applyRemoteChatVisibility, backfillHiddenChannels, loadChatVisibility } = await import('../lib/chatVisibility');
const { leaveGroupConv } = await import('../lib/xmtp.groups');
const { listVisibleConversations, acceptRequestConv, getConvConsentState } = await import('../lib/xmtp.conv');

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
});
