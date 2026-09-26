import { describe, expect, test } from 'bun:test';
import { accountDisplayName, accountSubtitle } from '../components/settings/SettingsAccountHeader.model';

describe('accountDisplayName', () => {
  test('prefers the resolved onchain name', () => {
    expect(accountDisplayName('fabien.stage.base.eth', 'Work', '0x12…34')).toBe('fabien.stage.base.eth');
  });
  test('falls back to the local label, then the short address', () => {
    expect(accountDisplayName(null, 'Work', '0x12…34')).toBe('Work');
    expect(accountDisplayName(undefined, undefined, '0x12…34')).toBe('0x12…34');
  });
  test('ignores blank labels', () => {
    expect(accountDisplayName(null, '  ', '0x12…34')).toBe('0x12…34');
  });
});

describe('accountSubtitle', () => {
  test('shows the short address under a resolved name', () => {
    expect(accountSubtitle('fabien.stage.base.eth', '0x12…34')).toBe('0x12…34');
  });
  test('offers the profile when the name is already the address', () => {
    expect(accountSubtitle('0x12…34', '0x12…34')).toBe('View profile');
  });
});
