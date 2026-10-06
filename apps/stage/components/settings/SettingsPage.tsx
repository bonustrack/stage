import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Card } from '@stage-labs/kit/react-native/card';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Switch } from '@stage-labs/kit/react-native/switch';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { useEffectiveColorScheme, usePalette, type ThemePreference } from '../../lib/theme';
import { Box, Col, ScreenScroll, PAGE_GUTTER } from '../layout';
import { StackHeader } from '../chrome/StackHeader';
import { Eyebrow } from '../Eyebrow';
import { AppIcon, type AppIconRef } from '../widgets';
import type { AppIconName } from '../appIcons';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';

const ROW_PADDING = { paddingTop: 14, paddingBottom: 14, paddingLeft: 16, paddingRight: 14 };

function SettingsList({ children }: { children: ReactNode }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return <ListView dark={dark}>{children}</ListView>;
}

function SettingsItem({ align = 'center', onPress, children }: {
  align?: 'center' | 'start'; onPress?: () => void; children: ReactNode;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align={align} gap={14} dark={dark} onPress={onPress} padding={ROW_PADDING}>
      {children}
    </ListViewItem>
  );
}

export function SettingsNavRow(props: {
  label: string;
  value?: string;
  iconStart?: AppIconRef;
  iconEnd?: AppIconRef;
  onPress?: () => void;
}): React.ReactElement {
  return (
    <SettingsItem onPress={props.onPress}>
      {props.iconStart === undefined ? null : (
        <AppIcon name={props.iconStart} color="link" size={24} />
      )}
      <Col flex={1}>
        <Text value={props.label} size="xs" color="link" truncate />
      </Col>
      {props.value === undefined ? null : (
        <Text value={props.value} size="2xs" color="secondary" truncate style={{ flexShrink: 1 }} />
      )}
      <AppIcon name={props.iconEnd ?? IconChevronRight} color="secondary" size={24} />
    </SettingsItem>
  );
}

export function SettingsToggleRow(props: {
  label: string;
  name: string;
  checked: boolean;
  disabled?: boolean;
  description?: string;
  onChange?: (checked: boolean) => void;
}): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <SettingsItem>
      <Col gap={2} flex={1}>
        <Text value={props.label} size="xs" color="link" />
        {props.description === undefined ? null : (
          <Caption value={props.description} color="secondary" />
        )}
      </Col>
      <Switch name={props.name} checked={props.checked} disabled={props.disabled} dark={dark} onChange={props.onChange} />
    </SettingsItem>
  );
}

export function SettingsValueRow(props: {
  label: string;
  value: string;
  onPress?: () => void;
}): React.ReactElement {
  return (
    <SettingsItem onPress={props.onPress}>
      <Col flex={1}>
        <Text value={props.label} size="xs" color="link" />
      </Col>
      <Text value={props.value} size="2xs" color="secondary" truncate style={{ flexShrink: 1 }} />
      {props.onPress === undefined ? null : (
        <AppIcon name={IconSquareBehindSquare1} color="secondary" size={16} />
      )}
    </SettingsItem>
  );
}

export function SettingsButtonRow(props: {
  label: string;
  description?: string;
  iconStart?: AppIconRef;
  onPress: () => void;
  danger?: boolean;
}): React.ReactElement {
  const tone = props.danger === true ? 'danger' : 'link';
  return (
    <SettingsItem align={props.description === undefined ? 'center' : 'start'} onPress={props.onPress}>
      {props.iconStart === undefined ? null : (
        <AppIcon name={props.iconStart} color={tone} size={24} />
      )}
      <Col gap={2} flex={1}>
        <Text value={props.label} size="xs" color={tone} />
        {props.description === undefined ? null : (
          <Caption value={props.description} color="secondary" />
        )}
      </Col>
    </SettingsItem>
  );
}

export const THEME_OPTIONS: { value: ThemePreference; label: string; icon: AppIconName }[] = [
  { value: 'system', label: 'System', icon: 'IconImac' },
  { value: 'light', label: 'Light', icon: 'IconSun' },
  { value: 'dark', label: 'Dark', icon: 'IconMoon' },
];

export function SettingsThemeRow(props: {
  label: string;
  iconName: AppIconRef;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <SettingsItem onPress={props.onPress}>
      <AppIcon name={props.iconName} color="link" size={24} />
      <Col flex={1}>
        <Text value={props.label} size="xs" color="link" truncate />
      </Col>
      {props.selected ? <AppIcon name={IconCheckmark1} color="link" size={24} /> : null}
    </SettingsItem>
  );
}

export function SettingsPage({ title, root = false, backTo = SETTINGS_ROUTE, panRef, keyboardShouldPersistTaps, children }: {
  title: string;
  root?: boolean;
  backTo?: string;
  panRef?: SimultaneousRefs;
  keyboardShouldPersistTaps?: 'handled';
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  return (
    <Col surface="surface" flex={1}>
      {root ? (Platform.OS === 'web' ? <StackHeader title={title}/> : null) : <StackHeader title={title} backTo={backTo} />}
      <ScreenScroll
        simultaneousHandlers={panRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {children}
      </ScreenScroll>
    </Col>
  );
}

export function SettingsSectionLabel({ children }: { children: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Eyebrow color={fg} style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 24, paddingBottom: 8, textTransform: 'uppercase' }}>
      {children}
    </Eyebrow>
  );
}

function SettingsCard({ children }: { children: ReactNode }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const { border } = usePalette();
  return (
    <Box margin={{ x: PAGE_GUTTER }} radius={BLOCK_RADIUS_DEFAULT} style={{ overflow: 'hidden' }}>
      <Card dark={dark} background={border} padding={0}>
        {children}
      </Card>
    </Box>
  );
}

export function SettingsGroup({ title, footnote, children }: {
  title?: string;
  footnote?: string;
  children: ReactNode;
}): React.ReactElement {
  return (
    <Col>
      {title === undefined ? <Box height={24} /> : <SettingsSectionLabel>{title}</SettingsSectionLabel>}
      <SettingsCard>
        <SettingsList>{children}</SettingsList>
      </SettingsCard>
      {footnote === undefined ? null : (
        <Caption value={footnote} color="secondary" style={{ paddingHorizontal: PAGE_GUTTER + 16, paddingTop: 8 }} />
      )}
    </Col>
  );
}
