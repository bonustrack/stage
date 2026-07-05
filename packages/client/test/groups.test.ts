import { describe, expect, test } from 'bun:test';
import {
  validMemberAddresses, isNoInboxError, isPermissionError, requireValidMembers,
  mapCreateGroupError, mapAddMembersError, createGroupWith, addGroupMembersWith,
} from '../src/xmtp/groups';

const ADDR_A = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';
const ADDR_B = '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5';

describe('validMemberAddresses', () => {
  test('trims and filters to valid hex addresses', () => {
    expect(validMemberAddresses([`  ${ADDR_A} `, 'nope', ADDR_B])).toEqual([ADDR_A, ADDR_B]);
  });
  test('rejects wrong length', () => {
    expect(validMemberAddresses(['0x123'])).toEqual([]);
  });
});

describe('error classification', () => {
  test('isNoInboxError', () => {
    expect(isNoInboxError('no inbox found')).toBe(true);
    expect(isNoInboxError('cannot find user')).toBe(true);
    expect(isNoInboxError('boom')).toBe(false);
  });
  test('isPermissionError', () => {
    expect(isPermissionError('only admin allowed')).toBe(true);
    expect(isPermissionError('boom')).toBe(false);
  });
});

describe('requireValidMembers', () => {
  test('throws on empty', () => {
    expect(() => requireValidMembers(['bad'])).toThrow('Add at least one valid member address.');
  });
  test('returns members', () => {
    expect(requireValidMembers([ADDR_A])).toEqual([ADDR_A]);
  });
});

describe('error mappers', () => {
  test('create no-inbox', () => {
    expect(mapCreateGroupError(new Error('no inbox')).message)
      .toBe("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('create generic', () => {
    expect(mapCreateGroupError(new Error('boom')).message).toBe("Couldn't create the group: boom");
  });
  test('add no-inbox', () => {
    expect(mapAddMembersError(new Error('not registered')).message)
      .toBe("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('add permission', () => {
    expect(mapAddMembersError(new Error('admin only')).message).toBe('Only a group admin can add members.');
  });
  test('add generic', () => {
    expect(mapAddMembersError(new Error('boom')).message).toBe("Couldn't add members: boom");
  });
});

describe('createGroupWith', () => {
  test('builds line + id from injected create', async () => {
    const res = await createGroupWith([ADDR_A], id => `metro://xmtp/${id}`, async () => ({ id: 'gid' }));
    expect(res).toEqual({ line: 'metro://xmtp/gid', id: 'gid' });
  });
  test('maps create error', async () => {
    await expect(createGroupWith([ADDR_A], id => id, async () => { throw new Error('no inbox'); }))
      .rejects.toThrow("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('validates before calling create', async () => {
    let called = false;
    await expect(createGroupWith(['bad'], id => id, async () => { called = true; return { id: 'x' }; }))
      .rejects.toThrow('Add at least one valid member address.');
    expect(called).toBe(false);
  });
});

describe('addGroupMembersWith', () => {
  test('passes validated members to injected add', async () => {
    let received: string[] = [];
    await addGroupMembersWith([` ${ADDR_A} `, 'bad'], async (m) => { received = m; });
    expect(received).toEqual([ADDR_A]);
  });
  test('maps add permission error', async () => {
    await expect(addGroupMembersWith([ADDR_A], async () => { throw new Error('admin only'); }))
      .rejects.toThrow('Only a group admin can add members.');
  });
});
