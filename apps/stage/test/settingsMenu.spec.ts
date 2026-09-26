import { describe, expect, test } from 'bun:test';
import { SETTINGS_MENU_SECTIONS, menuItemValue } from '../components/settings/SettingsMenu.model';
import { themeLabel } from '../components/settings/themeOptions.model';

describe('settingsMenu', () => {
  test('groups the settings pages into preferences, account and about', () => {
    expect(SETTINGS_MENU_SECTIONS.map((s) => [s.title, s.items.map((i) => i.href)])).toEqual([
      ['Preferences', ['/settings/display', '/settings/notifications', '/settings/messenger']],
      ['Account', ['/settings/wallet', '/settings/security']],
      [null, ['/settings/about']],
    ]);
  });

  test('leaves profile to the account card', () => {
    const hrefs = SETTINGS_MENU_SECTIONS.flatMap((s) => s.items.map((i) => i.href));
    expect(hrefs).not.toContain('/settings/profile');
  });

  test('shows the theme as the display value and nothing elsewhere', () => {
    const items = SETTINGS_MENU_SECTIONS.flatMap((s) => s.items);
    const values = items.map((i) => [i.label, menuItemValue(i, { theme: 'Dark' })]);
    expect(values).toEqual([
      ['Display', 'Dark'],
      ['Notifications', undefined],
      ['Messenger', undefined],
      ['Wallet', undefined],
      ['Security', undefined],
      ['About', undefined],
    ]);
  });
});

describe('themeLabel', () => {
  test('names the chosen preference', () => {
    expect(themeLabel('system', false)).toBe('System');
    expect(themeLabel('light', false)).toBe('Light');
    expect(themeLabel('dark', false)).toBe('Dark');
  });

  test('a custom theme wins over the preference', () => {
    expect(themeLabel('dark', true)).toBe('Custom');
  });
});
