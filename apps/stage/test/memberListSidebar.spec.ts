import { describe, expect, test } from 'bun:test';
import { memberListEntries } from '../components/conversation/MemberListSidebar.model';

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
});
