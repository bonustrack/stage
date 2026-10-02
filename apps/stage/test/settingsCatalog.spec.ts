import { describe, expect, test } from 'bun:test';
import { settingsSection } from '../components/settings/settingsCatalog.model';

describe('settingsCatalog', () => {
  test('finds a section by id, each under /settings', () => {
    expect(settingsSection('wallet')).toEqual({ href: '/settings/wallet', icon: 'IconWallet4' });
    expect(settingsSection('appearance').href).toBe('/settings/display');
    for (const id of ['profile', 'security', 'devices', 'advanced'] as const) {
      expect(settingsSection(id).href).toBe(`/settings/${id}`);
    }
  });
});
