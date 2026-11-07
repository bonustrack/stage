import type { AppIconName } from '../appIcons';
import { PAGES } from '../tabs/pages';

type HubGroup = 'preferences' | 'more';

interface SettingsSection {
  readonly href: string;
  readonly title: string;
  readonly hub?: { readonly group: HubGroup; readonly label: string; readonly icon?: AppIconName };
}

function settingsHref(page: string): string {
  return `${PAGES.settings.href}/${page}`;
}

export const SETTINGS_SECTIONS = {
  profile: { href: settingsHref('profile'), title: 'Profile' },
  appearance: { href: settingsHref('display'), title: 'Appearance', hub: { group: 'preferences', label: 'Appearance' } },
  security: {
    href: settingsHref('security'),
    title: 'Security',
    hub: { group: 'more', label: 'Recovery phrase and private key', icon: 'IconKey2' },
  },
  devices: { href: settingsHref('devices'), title: 'Devices', hub: { group: 'more', label: 'Devices and history', icon: 'IconDevices' } },
  wallet: { href: settingsHref('wallet'), title: 'Wallet', hub: { group: 'more', label: 'Wallet', icon: 'IconWallet4' } },
  advanced: { href: settingsHref('advanced'), title: 'Advanced', hub: { group: 'more', label: 'Advanced', icon: 'IconCode' } },
  notifications: { href: settingsHref('notifications'), title: 'Notifications' },
} as const satisfies Record<string, SettingsSection>;

export type SettingsSectionId = keyof typeof SETTINGS_SECTIONS;

type HubSectionId = {
  [K in SettingsSectionId]: (typeof SETTINGS_SECTIONS)[K] extends { readonly hub: object } ? K : never;
}[SettingsSectionId];

interface HubRow {
  readonly id: SettingsSectionId;
  readonly href: string;
  readonly label: string;
  readonly icon?: AppIconName;
}

const SECTION_IDS = Object.keys(SETTINGS_SECTIONS) as SettingsSectionId[];

export function hubRows(group: HubGroup): readonly HubRow[] {
  return SECTION_IDS.flatMap((id) => {
    const section: SettingsSection = SETTINGS_SECTIONS[id];
    return section.hub?.group === group ? [{ id, href: section.href, label: section.hub.label, icon: section.hub.icon }] : [];
  });
}

export function settingsBreadcrumb(id: HubSectionId): string {
  return `${PAGES.settings.label} > ${SETTINGS_SECTIONS[id].hub.label}`;
}
