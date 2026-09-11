import { describe, expect, test } from 'bun:test';
import { isSplitRoute, isTabRoute } from '../components/tabs/splitRoutes';

describe('isSplitRoute', () => {
  test('home, conversations, and direct messages split', () => {
    expect(isSplitRoute('/')).toBe(true);
    expect(isSplitRoute('/channel/abc')).toBe(true);
    expect(isSplitRoute('/0x1234567890abcdef1234567890abcdef12345678')).toBe(true);
    expect(isSplitRoute('/boorger')).toBe(true);
    expect(isSplitRoute('/fabien.eth')).toBe(true);
    expect(isSplitRoute('/profile/boorger')).toBe(true);
  });

  test('profiles, groups, settings, wallet, contacts, and accounts split', () => {
    expect(isSplitRoute('/group/abc')).toBe(true);
    expect(isSplitRoute('/profile/0xabc')).toBe(true);
    expect(isSplitRoute('/settings')).toBe(true);
    expect(isSplitRoute('/settings/security')).toBe(true);
    expect(isSplitRoute('/wallet')).toBe(true);
    expect(isSplitRoute('/wallet/send')).toBe(true);
    expect(isSplitRoute('/contacts')).toBe(true);
    expect(isSplitRoute('/accounts')).toBe(true);
  });

  test('other stack routes stay single-column', () => {
    expect(isSplitRoute('/new-group')).toBe(false);
    expect(isSplitRoute('/requests')).toBe(false);
  });
});

describe('isTabRoute', () => {
  test('only the four tab pages count', () => {
    expect(isTabRoute('/')).toBe(true);
    expect(isTabRoute('/wallet')).toBe(true);
    expect(isTabRoute('/wallet/send')).toBe(false);
    expect(isTabRoute('/settings/security')).toBe(false);
  });
});
