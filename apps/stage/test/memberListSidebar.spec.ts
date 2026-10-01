import { describe, expect, test } from 'bun:test';
import { assignedEntries, memberAdminMark, memberChanges, memberEditsText, memberListEntries } from '../components/conversation/MemberListSidebar.model';

const names: Record<string, string> = {
  '0xbbbb000000000000000000000000000000000002': 'zoe.base.eth',
  '0xcccc000000000000000000000000000000000003': 'Alice',
};

const nameOf = (address: string): string | undefined => names[address.toLowerCase()];
const shortOf = (address: string): string => `${address.slice(0, 6)}…${address.slice(-4)}`;

describe('memberListEntries', () => {
  test('named members come first by name, then the rest by address', () => {
    const entries = memberListEntries([
      '0xdddd000000000000000000000000000000000004',
      '0xbbbb000000000000000000000000000000000002',
      '0xaaaa000000000000000000000000000000000001',
      '0xcccc000000000000000000000000000000000003',
    ], nameOf, shortOf);
    expect(entries.map(e => e.name)).toEqual(['Alice', 'zoe.base.eth', '0xaaaa…0001', '0xdddd…0004']);
    expect(entries.map(e => e.named)).toEqual([true, true, false, false]);
  });

  test('an address listed twice in different case shows once', () => {
    const entries = memberListEntries([
      '0xAAAA000000000000000000000000000000000001',
      '0xaaaa000000000000000000000000000000000001',
    ], nameOf, shortOf);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.address).toBe('0xAAAA000000000000000000000000000000000001');
  });

  test('an empty name falls back to the short address', () => {
    const entries = memberListEntries(['0xeeee000000000000000000000000000000000005'], () => '', shortOf);
    expect(entries).toEqual([
      { address: '0xeeee000000000000000000000000000000000005', name: '0xeeee…0005', named: false },
    ]);
  });

  test('admins and super admins get a mark, matched in any address case', () => {
    const entries = memberListEntries([
      '0xAAAA000000000000000000000000000000000001',
      '0xbbbb000000000000000000000000000000000002',
      '0xcccc000000000000000000000000000000000003',
    ], nameOf, shortOf, {
      '0xaaaa000000000000000000000000000000000001': 'owner',
      '0xBBBB000000000000000000000000000000000002': 'admin',
      '0xcccc000000000000000000000000000000000003': 'member',
    });
    expect(entries.map(e => [e.name, e.admin?.label])).toEqual([
      ['Alice', undefined],
      ['zoe.base.eth', 'Admin'],
      ['0xAAAA…0001', 'Super admin'],
    ]);
  });
});

describe('assignedEntries', () => {
  test('zero or multiple current members, case insensitive and without duplicates', () => {
    const entries = memberListEntries(Object.keys(names), nameOf, shortOf);
    expect(assignedEntries(entries, [])).toEqual([]);
    expect(assignedEntries(entries, [Object.keys(names)[0]?.toUpperCase() ?? '', Object.keys(names)[0] ?? '', '0xgone'])).toEqual([entries[1]]);
    expect(assignedEntries(entries, Object.keys(names))).toEqual(entries);
  });
});

describe('memberAdminMark', () => {
  test('maps channel roles to the admin mark', () => {
    expect(memberAdminMark('owner')).toEqual({ role: 'superAdmin', label: 'Super admin' });
    expect(memberAdminMark('admin')).toEqual({ role: 'admin', label: 'Admin' });
    expect(memberAdminMark('member')).toBeUndefined();
    expect(memberAdminMark(undefined)).toBeUndefined();
  });
});

describe('memberEditsText', () => {
  test('says what changed, one or many', () => {
    expect(memberEditsText({ added: ['0xa'], removed: [] })).toBe('Member added');
    expect(memberEditsText({ added: [], removed: ['0xa', '0xb'] })).toBe('2 members removed');
    expect(memberEditsText({ added: ['0xa', '0xb'], removed: ['0xc'] })).toBe('2 members added. Member removed');
  });
});

describe('memberChanges', () => {
  test('skips people already added or already gone', () => {
    expect(memberChanges(['0xA', '0xB'], { added: ['0xa', '0xc'], removed: ['0xb', '0xd'] }))
      .toEqual({ added: ['0xc'], removed: ['0xb'] });
  });
});
