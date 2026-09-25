import { describe, expect, test } from 'bun:test';
import {
  validMemberAddresses, isNoInboxError, isPermissionError, requireValidMembers,
  mapCreateGroupError, mapAddMembersError, createGroupWith, addGroupMembersWith,
  groupRoleOf, groupEditRightsOf, canEditGroup, mapUpdateGroupError, updateGroupMetaWith, UNKNOWN_GROUP_POLICY,
  type GroupMetaPolicy,
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
    const res = await createGroupWith([ADDR_A], id => `stage://xmtp/${id}`, async () => ({ id: 'gid' }));
    expect(res).toEqual({ line: 'stage://xmtp/gid', id: 'gid' });
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

describe('groupRoleOf', () => {
  const staff = { admins: ['AdminInbox'], superAdmins: ['OwnerInbox'] };
  test('super admins are owners and admins are admins, case-insensitively', () => {
    expect(groupRoleOf('ownerinbox', staff)).toBe('owner');
    expect(groupRoleOf('ADMININBOX', staff)).toBe('admin');
    expect(groupRoleOf('someone', staff)).toBe('member');
  });
});

describe('groupEditRightsOf', () => {
  const policy = (p: GroupMetaPolicy['name']): GroupMetaPolicy => ({ name: p, description: p, image: p });
  test('allow lets every member edit', () => {
    expect(groupEditRightsOf(policy('allow'), 'member')).toEqual({ name: true, description: true, image: true });
  });
  test('admin policy needs an admin or the owner', () => {
    expect(canEditGroup(groupEditRightsOf(policy('admin'), 'member'))).toBe(false);
    expect(canEditGroup(groupEditRightsOf(policy('admin'), 'admin'))).toBe(true);
    expect(canEditGroup(groupEditRightsOf(policy('admin'), 'owner'))).toBe(true);
  });
  test('superAdmin policy needs the owner', () => {
    expect(canEditGroup(groupEditRightsOf(policy('superAdmin'), 'admin'))).toBe(false);
    expect(canEditGroup(groupEditRightsOf(policy('superAdmin'), 'owner'))).toBe(true);
  });
  test('deny locks everyone out', () => {
    expect(canEditGroup(groupEditRightsOf(policy('deny'), 'owner'))).toBe(false);
  });
  test('an unknown policy stays open and lets the network decide', () => {
    expect(groupEditRightsOf(UNKNOWN_GROUP_POLICY, 'member')).toEqual({ name: true, description: true, image: true });
  });
  test('rights are per field', () => {
    const rights = groupEditRightsOf({ name: 'admin', description: 'allow', image: 'deny' }, 'member');
    expect(rights).toEqual({ name: false, description: true, image: false });
    expect(canEditGroup(rights)).toBe(true);
    const imageOnly = groupEditRightsOf({ name: 'deny', description: 'deny', image: 'allow' }, 'member');
    expect(imageOnly).toEqual({ name: false, description: false, image: true });
    expect(canEditGroup(imageOnly)).toBe(true);
  });
});

describe('updateGroupMetaWith', () => {
  const recorder = (fail?: string): { calls: string[]; ops: Parameters<typeof updateGroupMetaWith>[1] } => {
    const calls: string[] = [];
    const op = (kind: string) => async (v: string): Promise<void> => {
      if (kind === fail) throw new Error('Insufficient permissions');
      calls.push(`${kind}:${v}`);
    };
    return { calls, ops: { updateName: op('name'), updateImageUrl: op('image'), updateDescription: op('description') } };
  };
  test('writes only the fields in the patch', async () => {
    const { calls, ops } = recorder();
    await updateGroupMetaWith({ name: 'Crew', description: '' }, ops);
    expect(calls).toEqual(['name:Crew', 'description:']);
  });
  test('an empty image url is written, which removes the picture', async () => {
    const { calls, ops } = recorder();
    await updateGroupMetaWith({ imageUrl: '' }, ops);
    expect(calls).toEqual(['image:']);
  });
  test('maps a rejected update to the permission message', async () => {
    const { ops } = recorder('image');
    await expect(updateGroupMetaWith({ imageUrl: 'https://x/y.png' }, ops))
      .rejects.toThrow("You don't have permission to edit this group.");
  });
  test('keeps other errors as they are', () => {
    expect(mapUpdateGroupError(new Error('network down')).message).toBe('network down');
  });
});
