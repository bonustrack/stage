import { describe, expect, test } from 'bun:test';
import { isGroupRow, listedConvRow, memberAddressesOf, rowCreatedTs, sameConvRow } from '../modules/messaging/convRow.model';

describe('listedConvRow', () => {
  test('a listed direct chat gives the peer and its address map', () => {
    const rows = [{ convId: 'c1', peerAddress: '0xabc', selfInboxId: 'me', inboxToAddr: { i1: '0xabc', bad: 3 } }];
    const row = listedConvRow(rows, 'c1');
    expect(row).toEqual({ peerAddress: '0xabc', groupName: undefined, avatarUri: null, inboxToAddr: { i1: '0xabc' }, selfInboxId: 'me' });
    expect(isGroupRow(row ?? null)).toBe(false);
    expect(memberAddressesOf(row ?? null)).toEqual([]);
  });

  test('a listed channel gives its name, image and the other members', () => {
    const rows = [{
      convId: 'g', peerAddress: null, groupName: 'Team', title: '3 members', avatarUri: 'https://x/a.png', selfInboxId: 'me',
      inboxToAddr: { me: '0xme', i1: '0xa', i2: '0xb' },
    }];
    const row = listedConvRow(rows, 'g') ?? null;
    expect(row?.groupName).toBe('Team');
    expect(row?.avatarUri).toBe('https://x/a.png');
    expect(isGroupRow(row)).toBe(true);
    expect(memberAddressesOf(row)).toEqual(['0xa', '0xb']);
  });

  test('a channel row without a name or image never borrows the list title', () => {
    expect(listedConvRow([{ convId: 'g', peerAddress: null, title: '3 members', avatarUri: null }], 'g'))
      .toEqual({ peerAddress: null, groupName: undefined, avatarUri: null, inboxToAddr: {}, selfInboxId: '' });
  });

  test('unresolved peers and unknown chats are not listed', () => {
    expect(listedConvRow([{ convId: 'd', peerAddress: '' }], 'd')).toBeUndefined();
    expect(listedConvRow([{ convId: 'u' }], 'u')).toBeUndefined();
    expect(listedConvRow([], 'x')).toBeUndefined();
    expect(listedConvRow(null, 'x')).toBeUndefined();
    expect(memberAddressesOf(null)).toEqual([]);
  });
});

describe('rowCreatedTs', () => {
  const original = { id: 'original', createdNs: 10_000_000 };
  const replacement = { id: 'replacement', createdNs: 90_000_000 };
  const ns = (conv: typeof original): number => conv.createdNs;
  const lookup = async (id: string): Promise<typeof original | null> => id === original.id ? original : null;
  const missing = async (): Promise<null> => null;

  test('channels and unmapped DMs use their SDK creation time', async () => {
    expect(await rowCreatedTs(original, original.id, undefined, lookup, ns)).toBe(10);
    expect(await rowCreatedTs(replacement, replacement.id, undefined, lookup, ns)).toBe(90);
  });

  test('replacement DMs preserve the canonical creation time from cache or SDK', async () => {
    expect(await rowCreatedTs(replacement, original.id, 10, missing, ns)).toBe(10);
    expect(await rowCreatedTs(replacement, original.id, undefined, lookup, ns)).toBe(10);
    expect(await rowCreatedTs(replacement, original.id, null, lookup, ns)).toBe(10);
    expect(await rowCreatedTs(replacement, 'unknown', undefined, missing, ns)).toBeNull();
  });

  test('invalid or absent creation times remain unknown', async () => {
    for (const invalid of [0, -1, NaN, Infinity]) {
      expect(await rowCreatedTs({ ...original, createdNs: invalid }, original.id, undefined, lookup, ns)).toBeNull();
      expect(await rowCreatedTs(replacement, original.id, invalid, lookup, ns)).toBe(10);
    }
  });
});

describe('sameConvRow', () => {
  const row = { peerAddress: null, groupName: 'Team', avatarUri: null, inboxToAddr: { me: '0xme', i1: '0xa' }, selfInboxId: 'me' };

  test('equal content is the same row', () => {
    expect(sameConvRow(row, { ...row, inboxToAddr: { ...row.inboxToAddr } })).toBe(true);
  });

  test('a member, name or image change is a new row', () => {
    expect(sameConvRow(row, { ...row, inboxToAddr: { me: '0xme' } })).toBe(false);
    expect(sameConvRow(row, { ...row, groupName: 'Crew' })).toBe(false);
    expect(sameConvRow(row, { ...row, avatarUri: 'https://x/a.png' })).toBe(false);
  });
});
