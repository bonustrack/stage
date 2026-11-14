import { describe, expect, test } from 'bun:test';
import { peerProfileMenu, profileDisplayName } from '../components/ProfileScreen.model';

describe('profileDisplayName', () => {
  test('empty address shows loading placeholder', () => {
    expect(profileDisplayName('', 'alice', '0x12…cd')).toBe('Loading…');
  });

  test('resolved name wins and is trimmed', () => {
    expect(profileDisplayName('0xabc', '  alice.eth  ', '0x12…cd')).toBe('alice.eth');
  });

  test('missing or blank name falls back to short address', () => {
    expect(profileDisplayName('0xabc', undefined, '0x12…cd')).toBe('0x12…cd');
    expect(profileDisplayName('0xabc', null, '0x12…cd')).toBe('0x12…cd');
    expect(profileDisplayName('0xabc', '   ', '0x12…cd')).toBe('0x12…cd');
  });
});

describe('peerProfileMenu', () => {
  test('offers Report, and Block or Unblock once the block state is known', () => {
    expect(peerProfileMenu(false, false).map((i) => i.id)).toEqual(['message', 'copy-address', 'report', 'block']);
    expect(peerProfileMenu(false, true).map((i) => i.id)).toEqual(['message', 'copy-address', 'report', 'unblock']);
    expect(peerProfileMenu(false, null).map((i) => i.id)).toEqual(['message', 'copy-address', 'report']);
    expect(peerProfileMenu(true, false).map((i) => i.id)).toEqual(['message', 'send', 'copy-address', 'report', 'block']);
  });
});
