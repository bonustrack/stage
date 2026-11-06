import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { SETTINGS_SECTIONS, hubRows, settingsBreadcrumb } from '../components/settings/settingsCatalog.model';

const SETTINGS_ROUTE_FILES = readdirSync(join(import.meta.dir, '..', 'app', 'settings')).map(
  (file) => `/settings/${file.replace(/\.tsx$/, '')}`,
);

describe('settingsCatalog', () => {
  test('every settings page has a route under /settings and every route there is in the catalog', () => {
    expect(
      Object.values(SETTINGS_SECTIONS)
        .map((section) => section.href)
        .sort(),
    ).toEqual([...SETTINGS_ROUTE_FILES].sort());
  });

  test('the hub lists Appearance among the preferences and the other pages under More, with their icons', () => {
    expect(hubRows('preferences').map((row) => [row.href, row.label, row.icon])).toEqual([['/settings/display', 'Appearance', undefined]]);
    expect(hubRows('more').map((row) => [row.href, row.label, row.icon])).toEqual([
      ['/settings/security', 'Recovery phrase and private key', 'IconKey2'],
      ['/settings/devices', 'Devices and history', 'IconDevices'],
      ['/settings/wallet', 'Wallet', 'IconWallet4'],
      ['/settings/advanced', 'Advanced', 'IconCode'],
    ]);
  });

  test('copy that points to a settings page uses the label the hub shows', () => {
    expect(settingsBreadcrumb('devices')).toBe('Settings > Devices and history');
    expect(SETTINGS_SECTIONS.devices.title).toBe('Devices');
  });
});
