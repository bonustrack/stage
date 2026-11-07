import { describe, expect, test } from 'bun:test';
import { profileDisplayName } from '../components/profile/ProfileScreen.model';

describe('profileDisplayName', () => {
  test('empty address shows loading placeholder', () => {
    expect(profileDisplayName('', () => 'alice')).toBe('Loading…');
  });

  test('an address shows its peer label', () => {
    expect(profileDisplayName('0xabc', (address) => `label of ${address}`)).toBe('label of 0xabc');
  });
});
