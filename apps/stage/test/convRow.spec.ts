import { describe, expect, test } from 'bun:test';
import { isGroupRow, listedConvRow, memberAddressesOf, sameConvRow } from '../modules/messaging/convRow.model';

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
