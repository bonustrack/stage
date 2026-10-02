import { describe, expect, test } from 'bun:test';
import {
  validMemberAddresses, isNoInboxError, isPermissionError, requireValidMembers,
  mapCreateGroupError, mapAddMembersError, createGroupWith, addGroupMembersWith,
  groupRoleOf, superAdminInboxIds, groupEditRightsOf, canEditGroup, mapUpdateGroupError, updateGroupMetaWith, UNKNOWN_GROUP_POLICY,
  groupMetaPolicyOfSet,
  type GroupMetaPolicy,
} from '../src/xmtp/groups';

const ADDR_A = '0x0bA043c6F25085C68042bad079c29bD8f16a651A';
const ADDR_B = '0x25391bddaa8d7ecdfe183615c1005259cd3b79d5';
const LIBXMTP_ADDRESS_NOT_FOUND = '[GroupError::AddressNotFound] Addresses not found []';
const onXmtp = async (): Promise<string> => 'inbox';

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
    expect(isNoInboxError(LIBXMTP_ADDRESS_NOT_FOUND)).toBe(true);
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
  test('create libxmtp address not found', () => {
    expect(mapCreateGroupError(new Error(LIBXMTP_ADDRESS_NOT_FOUND)).message)
      .toBe("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('create generic', () => {
    expect(mapCreateGroupError(new Error('boom')).message).toBe("Couldn't create the channel: boom");
  });
  test('add no-inbox', () => {
    expect(mapAddMembersError(new Error('not registered')).message)
      .toBe("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('add permission', () => {
    expect(mapAddMembersError(new Error('admin only')).message).toBe('Only a channel admin can add members.');
  });
  test('add generic', () => {
    expect(mapAddMembersError(new Error('boom')).message).toBe("Couldn't add members: boom");
  });
});

describe('createGroupWith', () => {
  test('builds line + id from injected create', async () => {
    const res = await createGroupWith([ADDR_A], id => `stage://xmtp/${id}`, async () => ({ id: 'gid' }), onXmtp);
    expect(res).toEqual({ line: 'stage://xmtp/gid', id: 'gid' });
  });
  test('maps create error', async () => {
    await expect(createGroupWith([ADDR_A], id => id, async () => { throw new Error('no inbox'); }, onXmtp))
      .rejects.toThrow("One or more addresses aren't on XMTP yet, so they can't be added.");
  });
  test('validates before calling create', async () => {
    let called = false;
    await expect(createGroupWith(['bad'], id => id, async () => { called = true; return { id: 'x' }; }, onXmtp))
      .rejects.toThrow('Add at least one valid member address.');
    expect(called).toBe(false);
  });
  test('names the member not on XMTP and creates nothing', async () => {
    let called = false;
    const inboxIdOf = async (address: string): Promise<string | undefined> => (address === ADDR_B ? undefined : 'inbox');
    await expect(createGroupWith([ADDR_A, ADDR_B], id => id, async () => { called = true; return { id: 'x' }; }, inboxIdOf))
      .rejects.toThrow("0x2539…79d5 isn't on XMTP yet, so they can't be added.");
    expect(called).toBe(false);
  });
  test('names every member not on XMTP', async () => {
    await expect(createGroupWith([ADDR_A, ADDR_B], id => id, async () => ({ id: 'x' }), async () => undefined))
      .rejects.toThrow("0x0bA0…651A, 0x2539…79d5 aren't on XMTP yet, so they can't be added.");
  });
  test('maps a failed member lookup', async () => {
    await expect(createGroupWith([ADDR_A], id => id, async () => ({ id: 'x' }), async () => { throw new Error('boom'); }))
      .rejects.toThrow("Couldn't create the channel: boom");
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
      .rejects.toThrow('Only a channel admin can add members.');
  });
});

describe('superAdminInboxIds', () => {
  test('only current members whose role is super admin, never plain admins', () => {
    const inboxToAddr = { OwnerInbox: '0xowner', admininbox: '0xadmin', memberinbox: '0xmember' };
    const roles = { '0xowner': 'owner', '0xadmin': 'admin', '0xmember': 'member', '0xgone': 'owner' } as const;
    expect([...superAdminInboxIds(inboxToAddr, roles)]).toEqual(['ownerinbox']);
    expect(superAdminInboxIds(inboxToAddr, {}).size).toBe(0);
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

describe('groupMetaPolicyOfSet', () => {
  test('reads name, description and image from their own policies', () => {
    expect(groupMetaPolicyOfSet({
      updateGroupNamePolicy: 'admin',
      updateGroupDescriptionPolicy: 'deny',
      updateGroupImagePolicy: 'superAdmin',
      updateAppDataPolicy: 'admin',
      addMemberPolicy: 'allow',
      removeMemberPolicy: 'admin',
    })).toEqual({ name: 'admin', description: 'deny', image: 'superAdmin', appData: 'admin', addMember: 'allow', removeMember: 'admin' });
  });
});

describe('groupEditRightsOf', () => {
  const policy = (p: GroupMetaPolicy['name']): GroupMetaPolicy => ({ name: p, description: p, image: p, appData: p, addMember: p, removeMember: p });
  const members = { addMember: 'allow', removeMember: 'admin' } as const;
  test('allow lets every member edit', () => {
    expect(groupEditRightsOf(policy('allow'), 'member')).toEqual({
      name: true, description: true, image: true, appData: true, addMembers: true, removeMembers: true,
    });
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
  test('unknown metadata policies stay open but assignment waits for a known policy', () => {
    expect(groupEditRightsOf(UNKNOWN_GROUP_POLICY, 'member')).toEqual({
      name: true, description: true, image: true, appData: false, addMembers: true, removeMembers: true,
    });
  });
  test('rights are per field', () => {
    const rights = groupEditRightsOf({ name: 'admin', description: 'allow', image: 'deny', appData: 'admin', ...members }, 'member');
    expect(rights).toEqual({ name: false, description: true, image: false, appData: false, addMembers: true, removeMembers: false });
    expect(canEditGroup(rights)).toBe(true);
    const imageOnly = groupEditRightsOf({ name: 'deny', description: 'deny', image: 'allow', appData: 'deny', ...members }, 'member');
    expect(imageOnly).toEqual({ name: false, description: false, image: true, appData: false, addMembers: true, removeMembers: false });
    expect(canEditGroup(imageOnly)).toBe(true);
  });
  test('assignees follow the appData policy independently of names and images', () => {
    const appDataOnly: GroupMetaPolicy = { name: 'deny', description: 'deny', image: 'deny', appData: 'admin', ...members };
    expect(groupEditRightsOf(appDataOnly, 'member').appData).toBe(false);
    expect(canEditGroup(groupEditRightsOf(appDataOnly, 'admin'))).toBe(true);
    expect(groupEditRightsOf({ ...appDataOnly, appData: 'superAdmin' }, 'admin').appData).toBe(false);
    expect(groupEditRightsOf({ ...appDataOnly, appData: 'superAdmin' }, 'owner').appData).toBe(true);
    expect(groupEditRightsOf({ ...appDataOnly, appData: 'deny' }, 'owner').appData).toBe(false);
  });
  test('member changes follow their own policies and never make the channel editable', () => {
    const locked: GroupMetaPolicy = { name: 'deny', description: 'deny', image: 'deny', appData: 'deny', ...members };
    expect(groupEditRightsOf(locked, 'member')).toMatchObject({ addMembers: true, removeMembers: false });
    expect(groupEditRightsOf(locked, 'admin')).toMatchObject({ addMembers: true, removeMembers: true });
    expect(groupEditRightsOf({ ...locked, addMember: 'superAdmin', removeMember: 'deny' }, 'admin'))
      .toMatchObject({ addMembers: false, removeMembers: false });
    expect(canEditGroup(groupEditRightsOf(locked, 'owner'))).toBe(false);
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
      .rejects.toThrow("You don't have permission to edit this channel.");
  });
  test('keeps other errors as they are', () => {
    expect(mapUpdateGroupError(new Error('network down')).message).toBe('network down');
  });
});
