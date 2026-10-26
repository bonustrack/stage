import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { Text } from '@stage-labs/kit/react-native/text';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from '../Avatar';
import { MenuSheet } from '../MenuSheet';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { capabilities } from '../../lib/capabilities';
import { usePushEnabled } from '../../lib/pushPref';
import { retryDeveloperMode, setDeveloperMode, useDeveloperMode, useDeveloperModeLoaded, useDeveloperModeLoadFailed } from '../../lib/developerMode';
import { RetryNotice } from '../chrome/RetryNotice';
import { reported } from '../../lib/errorPolicy';
import { isPushSupported } from '../../lib/pushRegister';
import {
  setCustomTheme, setThemePreference, useCustomTheme, useEffectiveColorScheme, useThemePreference,
} from '../../lib/theme';
import { getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { listXmtpInstallations } from '../../lib/xmtp.client';
import { prefetchInbox, useMailboxes } from '../../lib/mail';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useWebTabRail } from '../../lib/webLayout';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { EditProfileModal } from './EditProfileModal';
import { applyPush } from './NotificationsSettings';
import { SettingsGroup, SettingsNavRow, SettingsPage, SettingsToggleRow, THEME_OPTIONS } from './SettingsPage';
import { SettingsAboutFooter } from './SettingsAboutFooter';
import { settingsSection } from './settingsCatalog.model';
import { menuPagesFor } from '../tabs/menuPages';
import { Column, Row, PAGE_GUTTER } from '../layout';

function accountDisplayName(peerName: string | null | undefined, label: string | undefined, fallback: string): string {
  const candidate = peerName ?? label;
  return candidate !== undefined && candidate !== null && candidate.trim() !== '' ? candidate : fallback;
}

function IdentityHero(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const rec = useActiveAccountRecord();
  const address = rec?.address ?? null;
  usePeerProfiles([address]);
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const [editing, setEditing] = useState(false);
  if (rec === null || address === null) return null;
  const short = shortAddress(address);
  const handle = getPeerHandle(address);
  const sub = [handle ? displayHandle(handle) : null, short].filter((p) => p !== null).join(' · ');
  const edit = (): void => { if (handle) setEditing(true); else capabilities.navigate(settingsSection('profile').href); };
  return (
    <Column gap={16} padding={{ x: PAGE_GUTTER, top: 24 }}>
      <Row align="center" gap={16}>
        <Avatar address={address} size={72} />
        <Column weight={1} gap={2}>
          <Text text={accountDisplayName(getPeerName(address), rec.label, short)} size="2xl" fontWeight="semibold" color="link" truncate />
          <Text text={sub} size="xs" color="secondary" />
        </Column>
      </Row>
      <Row gap={8}>
        <Button label="Edit profile" size="md" color="secondary" variant="solid" dark={dark} onPress={edit} />
        <Button label="Switch account" size="md" color="secondary" variant="solid" dark={dark} onPress={(e) => { setAnchor(menuPointBelow(e)); }} />
      </Row>
      <MenuSheet visible={anchor !== null} anchor={anchor} onClose={() => { setAnchor(null); }} />
      {handle ? <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} /> : null}
    </Column>
  );
}

function useDeviceCount(): number | null {
  const epoch = useAccountEpoch();
  const { data } = useQuery({
    queryKey: ['xmtpInstallations', epoch],
    queryFn: async () => (await listXmtpInstallations()).length,
    staleTime: 60_000,
    retry: false,
  });
  return data ?? null;
}

const THEME_TABS = THEME_OPTIONS.map((o) => ({ title: o.label }));

function PreferencesGroup(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const push = usePushEnabled();
  const developerMode = useDeveloperMode();
  const developerModeLoaded = useDeveloperModeLoaded();
  const developerModeFailed = useDeveloperModeLoadFailed();
  const pushSupported = isPushSupported();
  return (
    <SettingsGroup title="Preferences">
      <ListViewItem align="center" gap={14} dark={dark} padding={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 14 }}>
        <Text text="Theme" size="xs" color="link" style={{ flex: 1 }} />
        <Column width={260}>
          <Tabs tabs={THEME_TABS} selectedIndex={custom ? -1 : THEME_OPTIONS.findIndex((o) => o.value === pref)} dark={dark}
            onChange={(index) => { const v = THEME_OPTIONS[index]?.value; if (v === undefined) return; setCustomTheme(false); void setThemePreference(v); }} />
        </Column>
      </ListViewItem>
      <SettingsToggleRow label="Push notifications" name="push" checked={push && pushSupported} disabled={!pushSupported}
        description={pushSupported ? undefined : 'Push notifications are unavailable in this browser.'}
        onChange={(next) => { void applyPush(next); }} />
      <SettingsNavRow label="Appearance" value={custom ? 'Custom colors' : undefined} onPress={() => { capabilities.navigate(settingsSection('appearance').href); }} />
      <SettingsToggleRow label="Developer mode" name="developer-mode" checked={developerMode} disabled={!developerModeLoaded}
        description="Show Check sync, Storage, Inbox and Dashboard on all your devices."
        onChange={(enabled) => { void setDeveloperMode(enabled).catch(reported('developerMode.save')); }} />
      {developerModeFailed ? <RetryNotice message="Developer mode could not be loaded." onRetry={retryDeveloperMode} /> : null}
    </SettingsGroup>
  );
}

function MoreGroup(): React.ReactElement {
  const count = useDeviceCount();
  const address = useActiveAccountRecord()?.address;
  const boxes = useMailboxes().data;
  const developerMode = useDeveloperMode();
  const pages = useWebTabRail() ? [] : menuPagesFor((boxes?.length ?? 0) > 0, developerMode);
  useEffect(() => { if (developerMode && boxes !== undefined) prefetchInbox(boxes); }, [boxes, developerMode]);
  const row = (id: 'security' | 'devices' | 'wallet' | 'advanced', label: string, value?: string): React.ReactElement => {
    const section = settingsSection(id);
    return <SettingsNavRow label={label} iconStart={section.icon} value={value} onPress={() => { capabilities.navigate(section.href); }} />;
  };
  return (
    <SettingsGroup title="More">
      {pages.map((page) => (
        <SettingsNavRow key={page.href} label={page.label} iconStart={page.icon} onPress={() => { capabilities.navigate(page.href); }} />
      ))}
      {row('security', 'Recovery phrase and private key')}
      {row('devices', 'Devices and history', count === null ? undefined : `${count} signed in`)}
      {row('wallet', 'Wallet', address ? shortAddress(address) : undefined)}
      {row('advanced', 'Advanced')}
    </SettingsGroup>
  );
}

function SettingsHub(): React.ReactElement {
  return (
    <Column>
      <IdentityHero />
      <PreferencesGroup />
      <MoreGroup />
    </Column>
  );
}

export function SettingsMenu({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  return (
    <SettingsPage title="Settings" root panRef={panRef}>
      <SettingsHub />
      <SettingsAboutFooter />
    </SettingsPage>
  );
}
