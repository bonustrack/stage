import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { Text } from '@stage-labs/kit/react-native/text';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from '../Avatar';
import { accountName } from '../../lib/convIdentity';
import { MenuSheet } from './MenuSheet';
import type { SimultaneousRefs } from '../layout/simultaneousRefs';
import { menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { capabilities } from '../../lib/capabilities';
import { setDeveloperMode } from '../../lib/developerMode';
import { reported } from '../../lib/errorPolicy';
import { chooseTheme, useEffectiveColorScheme, useThemeChoice } from '../../lib/theme';
import { getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { useInstallations } from '../../lib/deviceAccount';
import { prefetchInbox, useMailboxes } from '../../lib/mail';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useWebTabRail } from '../layout/webLayout';
import { useActiveAccountRecord } from '../../lib/messaging/account';
import { useEditProfile } from '../profile/useEditProfile';
import { PUSH_UNAVAILABLE, PushToggleRow } from './PushToggleRow';
import { SettingsGroup, SettingsNavRow, SettingsToggleRow, THEME_OPTIONS } from './SettingsPage';
import { SettingsAboutFooter } from './SettingsAboutFooter';
import { hubRows, type SettingsSectionId } from './settingsCatalog.model';
import { StackPage } from '../chrome/StackPage';
import { developerModeDescription, settingsMenuPages } from '../tabs/menuPages';
import { DeveloperModeRetry, useDeveloperModeStatus } from '../tabs/MenuPage';
import { PAGES } from '../tabs/pages';
import { renderedByRoute } from '../tabs/pageRenderer';
import { Column, Row, PAGE_GUTTER } from '../layout';

function IdentityHero(): React.ReactElement | null {
  const dark = useEffectiveColorScheme() === 'dark';
  const rec = useActiveAccountRecord();
  const address = rec?.address ?? null;
  usePeerProfiles([address]);
  const [anchor, setAnchor] = useState<MenuPoint | null>(null);
  const editProfile = useEditProfile(true);
  if (rec === null || address === null) return null;
  const handle = getPeerHandle(address);
  const sub = handle ? `${displayHandle(handle)} · ${shortAddress(address)}` : shortAddress(address);
  return (
    <Column gap={16} padding={{ x: PAGE_GUTTER, top: 24 }}>
      <Row align="center" gap={16}>
        <Avatar address={address} size={72} />
        <Column weight={1} gap={2}>
          <Text text={accountName(rec, getPeerName(address))} size="2xl" fontWeight="semibold" color="link" truncate />
          <Text text={sub} size="xs" color="secondary" />
        </Column>
      </Row>
      <Row gap={8}>
        <Button label="Edit profile" size="md" color="secondary" variant="solid" dark={dark} onPress={editProfile.open} />
        <Button
          label="Switch account"
          size="md"
          color="secondary"
          variant="solid"
          dark={dark}
          onPress={(e) => {
            setAnchor(menuPointBelow(e));
          }}
        />
      </Row>
      <MenuSheet
        visible={anchor !== null}
        anchor={anchor}
        onClose={() => {
          setAnchor(null);
        }}
      />
      {editProfile.modal}
    </Column>
  );
}

const THEME_TABS = THEME_OPTIONS.map((o) => ({ title: o.label }));

function hubRowItems(group: 'preferences' | 'more', values: Partial<Record<SettingsSectionId, string>>): React.ReactElement[] {
  return hubRows(group).map((row) => (
    <SettingsNavRow
      key={row.id}
      label={row.label}
      iconStart={row.icon}
      value={values[row.id]}
      onPress={() => {
        capabilities.navigate(row.href);
      }}
    />
  ));
}

function PreferencesGroup(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const theme = useThemeChoice();
  const developerMode = useDeveloperModeStatus();
  return (
    <SettingsGroup title="Preferences">
      <ListViewItem align="center" gap={14} dark={dark} padding={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 14 }}>
        <Text text="Theme" size="xs" color="link" style={{ flex: 1 }} />
        <Column width={260}>
          <Tabs
            tabs={THEME_TABS}
            selectedIndex={THEME_OPTIONS.findIndex((o) => o.value === theme)}
            dark={dark}
            onChange={(index) => {
              const v = THEME_OPTIONS[index]?.value;
              if (v !== undefined) chooseTheme(v);
            }}
          />
        </Column>
      </ListViewItem>
      <PushToggleRow unsupportedNote={PUSH_UNAVAILABLE} />
      {hubRowItems('preferences', { appearance: theme === 'custom' ? 'Custom colors' : undefined })}
      <SettingsToggleRow
        label="Developer mode"
        name="developer-mode"
        checked={developerMode === 'on'}
        disabled={developerMode === 'loading' || developerMode === 'failed'}
        description={developerModeDescription()}
        onChange={(enabled) => {
          void setDeveloperMode(enabled).catch(reported('developerMode.save'));
        }}
      />
      {developerMode === 'failed' ? <DeveloperModeRetry /> : null}
    </SettingsGroup>
  );
}

function MoreGroup(): React.ReactElement {
  const count = useInstallations().data?.length ?? null;
  const address = useActiveAccountRecord()?.address;
  const boxes = useMailboxes().data;
  const developerMode = useDeveloperModeStatus() === 'on';
  const pages = useWebTabRail() ? [] : settingsMenuPages(developerMode, (boxes?.length ?? 0) > 0);
  useEffect(() => {
    if (developerMode && boxes !== undefined) prefetchInbox(boxes);
  }, [boxes, developerMode]);
  return (
    <SettingsGroup title="More">
      {pages.map((page) => (
        <SettingsNavRow
          key={page.href}
          label={page.label}
          iconStart={page.icon}
          onPress={() => {
            capabilities.navigate(page.href);
          }}
        />
      ))}
      {hubRowItems('more', {
        devices: count === null ? undefined : `${count} signed in`,
        wallet: address ? shortAddress(address) : undefined,
      })}
    </SettingsGroup>
  );
}

export function SettingsMenu({ panRef }: { panRef?: SimultaneousRefs } = {}): React.ReactElement {
  return (
    <StackPage title={PAGES.settings.label} header={renderedByRoute('settings')} panRef={panRef}>
      <Column>
        <IdentityHero />
        <PreferencesGroup />
        <MoreGroup />
      </Column>
      <SettingsAboutFooter />
    </StackPage>
  );
}
