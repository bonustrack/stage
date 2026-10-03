import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Tabs } from '@stage-labs/kit/react-native/tabs';
import { Text } from '@stage-labs/kit/react-native/text';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Avatar } from '../Avatar';
import { Box, Col, Row, PAGE_GUTTER } from '../layout';
import { MenuSheet } from '../MenuSheet';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { menuPointBelow } from '../AnchoredMenu';
import type { MenuPoint } from '../AnchoredMenu.model';
import { capabilities } from '../../lib/capabilities';
import { canExportPrivateKey } from '../../lib/accounts';
import { usePushEnabled } from '../../lib/pushPref';
import {
  setCustomTheme, setThemePreference, useCustomTheme, useEffectiveColorScheme, usePalette, useThemePreference,
  type ThemePreference,
} from '../../lib/theme';
import { getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { listXmtpInstallations } from '../../lib/xmtp.client';
import { useMailboxes, type Mailbox } from '../../lib/mail';
import { shortAddress } from '@stage-labs/client/identity/format';
import { useAccountEpoch } from '../../lib/accountEpoch';
import { useActiveAccountRecord } from '../../modules/messaging/account';
import { EditProfileModal } from './EditProfileModal';
import { useWalletBackedUp } from './RecoveryPhraseRow';
import { applyPush } from './NotificationsSettings';
import { SettingsGroup, SettingsNavRow, SettingsPage, SettingsToggleRow, THEME_OPTIONS } from './SettingsPage';
import { SettingsAboutFooter } from './SettingsAboutFooter';
import { settingsSection } from './settingsCatalog.model';
import { protectionSteps, protectionTitle, type ProtectionStep } from './protection.model';
import { IconCircleCheck } from '@central-icons-react-native/round-filled-radius-1-stroke-2/IconCircleCheck';
import { IconCircleDashed } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCircleDashed';

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
    <Col gap={16} padding={{ x: PAGE_GUTTER, top: 24 }}>
      <Row align="center" gap={16}>
        <Avatar address={address} size={72} />
        <Col flex={1} gap={2}>
          <Text value={accountDisplayName(getPeerName(address), rec.label, short)} size="2xl" weight="semibold" color="link" truncate />
          <Text value={sub} size="2xs" color="secondary" />
        </Col>
      </Row>
      <Row gap={8}>
        <Button label="Edit profile" size="md" color="secondary" variant="solid" dark={dark} onPress={edit} />
        <Button label="Switch account" size="md" color="secondary" variant="solid" dark={dark} onPress={(e) => { setAnchor(menuPointBelow(e)); }} />
      </Row>
      <MenuSheet visible={anchor !== null} anchor={anchor} onClose={() => { setAnchor(null); }} />
      {handle ? <EditProfileModal visible={editing} onClose={() => { setEditing(false); }} address={address} handle={handle} /> : null}
    </Col>
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

function StepRow({ step }: { step: ProtectionStep }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { success, sub } = usePalette();
  return (
    <Row align="center" gap={12} padding={{ y: 8 }}>
      <Glyph icon={step.done ? IconCircleCheck : IconCircleDashed} size={24} color={step.done ? success : sub} />
      <Text value={step.label} size="xs" color="link" style={{ flex: 1 }} />
      {step.done ? <Text value={step.doneText} size="2xs" color="secondary" /> : (
        <Button label={step.action} size="sm" color="primary" variant="solid" dark={dark}
          onPress={() => { capabilities.navigate(settingsSection('security').href); }} />
      )}
    </Row>
  );
}

function ProtectionCard(): React.ReactElement | null {
  const { border, success } = usePalette();
  const rec = useActiveAccountRecord();
  const backedUp = useWalletBackedUp();
  if (rec === null) return null;
  const steps = protectionSteps({
    isSmart: rec.type === 'smart', backedUp,
    canExportKey: canExportPrivateKey(rec),
  });
  if (steps.length === 0) return null;
  return (
    <Box margin={{ x: PAGE_GUTTER, top: 24 }} padding={16} radius="sm" style={{ borderWidth: 1, borderColor: border }}>
      <Text value={protectionTitle(steps)} size="sm" weight="semibold" color="link" />
      <Row gap={4} padding={{ top: 12, bottom: 8 }}>
        {steps.map((s) => <Box key={s.id} flex={1} height={4} radius="xs" background={s.done ? success : border} />)}
      </Row>
      {steps.map((s) => <StepRow key={s.id} step={s} />)}
    </Box>
  );
}

const THEME_TABS = THEME_OPTIONS.map((o) => ({ value: o.value, label: o.label }));

function isThemePreference(value: string): value is ThemePreference {
  return THEME_OPTIONS.some((o) => o.value === value);
}

function PreferencesGroup(): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pref = useThemePreference();
  const custom = useCustomTheme();
  const push = usePushEnabled();
  return (
    <SettingsGroup title="Preferences">
      <ListViewItem align="center" gap={14} dark={dark} padding={{ paddingTop: 10, paddingBottom: 10, paddingLeft: 16, paddingRight: 14 }}>
        <Text value="Theme" size="xs" color="link" style={{ flex: 1 }} />
        <Box width={260}>
          <Tabs value={custom ? 'custom' : pref} options={THEME_TABS} dark={dark}
            onChange={(v) => { if (!isThemePreference(v)) return; setCustomTheme(false); void setThemePreference(v); }} />
        </Box>
      </ListViewItem>
      <SettingsToggleRow label="Push notifications" name="push" checked={push} onChange={(next) => { void applyPush(next); }} />
      <SettingsNavRow label="Custom colors" value={custom ? 'On' : undefined} onPress={() => { capabilities.navigate(settingsSection('appearance').href); }} />
    </SettingsGroup>
  );
}

function mailboxesLabel(boxes: readonly Mailbox[]): string {
  return boxes.length === 1 ? boxes[0]?.mailAddress ?? '' : `${boxes.length} addresses`;
}

function MoreGroup(): React.ReactElement {
  const count = useDeviceCount();
  const address = useActiveAccountRecord()?.address;
  const boxes = useMailboxes().data ?? [];
  const row = (id: 'inbox' | 'security' | 'devices' | 'wallet' | 'advanced', label: string, value?: string): React.ReactElement => {
    const section = settingsSection(id);
    return <SettingsNavRow label={label} iconStart={section.icon} value={value} onPress={() => { capabilities.navigate(section.href); }} />;
  };
  return (
    <SettingsGroup title="More">
      {boxes.length > 0 ? row('inbox', 'Inbox', mailboxesLabel(boxes)) : null}
      {row('security', 'Recovery phrase and private key')}
      {row('devices', 'Devices and history', count === null ? undefined : `${count} signed in`)}
      {row('wallet', 'Wallet', address ? shortAddress(address) : undefined)}
      {row('advanced', 'Advanced')}
    </SettingsGroup>
  );
}

function SettingsHub(): React.ReactElement {
  return (
    <Col>
      <IdentityHero />
      <ProtectionCard />
      <PreferencesGroup />
      <MoreGroup />
    </Col>
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
