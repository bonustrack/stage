import { describe, expect, test } from 'bun:test';
import { profileDisplayName } from '../views/profile/profileScreenModel';

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
