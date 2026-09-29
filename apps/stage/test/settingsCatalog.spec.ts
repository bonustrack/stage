import { describe, expect, test } from 'bun:test';
import {
  SETTINGS_SECTIONS, settingsSection,
} from '../components/settings/settingsCatalog.model';

describe('settingsCatalog', () => {
  test('lists the seven sections in order, each under /settings', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
      'profile', 'appearance', 'notifications', 'security', 'devices', 'wallet', 'advanced',
    ]);
    for (const s of SETTINGS_SECTIONS) expect(s.href.startsWith('/settings/')).toBe(true);
  });

  test('finds a section by id', () => {
    expect(settingsSection('wallet').label).toBe('Wallet');
    expect(settingsSection('appearance').href).toBe('/settings/display');
  });
});
