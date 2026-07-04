import { describe, expect, test } from 'bun:test';
import { memberRowModel } from '../views/group/memberRowModel';

const SHORT = '0xabc0…0001';

describe('memberRowModel', () => {
  test('unnamed member falls back to the short address without an address line', () => {
    expect(memberRowModel({ shortAddress: SHORT, name: null, isSelf: false, role: undefined })).toEqual({
      displayName: SHORT,
      addressLine: undefined,
      badge: undefined,
    });
  });

  test('empty name behaves like no name', () => {
    expect(memberRowModel({ shortAddress: SHORT, name: '', isSelf: false, role: undefined }).displayName).toBe(SHORT);
    expect(memberRowModel({ shortAddress: SHORT, name: '', isSelf: false, role: undefined }).addressLine).toBeUndefined();
  });

  test('named member shows the name with the short address as a second line', () => {
    expect(memberRowModel({ shortAddress: SHORT, name: 'Alice', isSelf: false, role: undefined })).toEqual({
      displayName: 'Alice',
      addressLine: SHORT,
      badge: undefined,
    });
  });

  test('self gets the (you) suffix', () => {
    expect(memberRowModel({ shortAddress: SHORT, name: 'Alice', isSelf: true, role: undefined }).displayName).toBe('Alice (you)');
    expect(memberRowModel({ shortAddress: SHORT, name: null, isSelf: true, role: undefined }).displayName).toBe(`${SHORT} (you)`);
  });

  test('owner and admin roles map to badges, member maps to none', () => {
    expect(memberRowModel({ shortAddress: SHORT, name: 'A', isSelf: false, role: 'owner' }).badge).toEqual({ role: 'owner', label: 'Owner' });
    expect(memberRowModel({ shortAddress: SHORT, name: 'A', isSelf: false, role: 'admin' }).badge).toEqual({ role: 'admin', label: 'Admin' });
    expect(memberRowModel({ shortAddress: SHORT, name: 'A', isSelf: false, role: 'member' }).badge).toBeUndefined();
  });
});
