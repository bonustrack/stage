import { describe, expect, test } from 'bun:test';
import {
  SETTINGS_GROUPS, SETTINGS_SECTIONS, settingsSection,
} from '../components/settings/settingsCatalog.model';

describe('settingsCatalog', () => {
  test('lists the seven sections in order, each under /settings', () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).toEqual([
      'profile', 'appearance', 'notifications', 'security', 'devices', 'wallet', 'advanced',
    ]);
    for (const s of SETTINGS_SECTIONS) expect(s.href.startsWith('/settings/')).toBe(true);
  });

  test('groups cover every section except profile exactly once', () => {
    const grouped = SETTINGS_GROUPS.flat();
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(SETTINGS_SECTIONS.map((s) => s.id).filter((id) => id !== 'profile').sort());
  });

  test('finds a section by id', () => {
    expect(settingsSection('wallet').label).toBe('Wallet');
    expect(settingsSection('appearance').href).toBe('/settings/display');
  });
});
