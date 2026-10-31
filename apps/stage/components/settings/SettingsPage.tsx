import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import type { SimultaneousRefs } from '../SwipeTabs.types';
import { Card } from '@stage-labs/kit/react-native/card';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { BLOCK_RADIUS_DEFAULT } from '@stage-labs/kit/tokens';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { SETTINGS_ROUTE } from '../../lib/routes';
import { useEffectiveColorScheme, usePalette, type ThemePreference } from '../../lib/theme';
import type { FontPreviewScope } from '../../lib/fontChoice';
import { StackHeader } from '../chrome/StackHeader';
import { Eyebrow } from '../Eyebrow';
import { AppIcon, type AppIconRef } from '../widgets';
import type { AppIconName } from '../appIcons';
import { IconCheckmark1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCheckmark1';
import { IconChevronRight } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconChevronRight';
import { IconSquareBehindSquare1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconSquareBehindSquare1';
import { Text } from '@stage-labs/kit/react-native/text';
import { CheckBox } from '@stage-labs/kit/react-native/check-box';
import { Column, Row, ScreenScroll, PAGE_GUTTER } from '../layout';

const ROW_PADDING = { paddingTop: 14, paddingBottom: 14, paddingLeft: 16, paddingRight: 14 };

function SettingsItem({
  align = 'center',
  onPress,
  children,
}: {
  align?: 'center' | 'start';
  onPress?: () => void;
  children: ReactNode;
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
      {props.iconStart === undefined ? null : <AppIcon name={props.iconStart} color="link" size={24} />}
      <Column weight={1}>
        <Text text={props.label} size="xs" color="link" truncate />
      </Column>
      {props.value === undefined ? null : <Text text={props.value} size="xs" color="secondary" truncate style={{ flexShrink: 1 }} />}
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
      <Column gap={2} weight={1}>
        <Text text={props.label} size="xs" color="link" />
        {props.description === undefined ? null : <Text size="md" variant="caption" text={props.description} color="secondary" />}
      </Column>
      <CheckBox
        displayStyle="switch"
        name={props.name}
        value={props.checked}
        disabled={props.disabled}
        dark={dark}
        onChange={props.onChange}
      />
    </SettingsItem>
  );
}

export function SettingsValueRow(props: { label: string; value: string; onPress?: () => void }): React.ReactElement {
  return (
    <SettingsItem onPress={props.onPress}>
      <Column weight={1}>
        <Text text={props.label} size="xs" color="link" />
      </Column>
      <Text text={props.value} size="xs" color="secondary" truncate style={{ flexShrink: 1 }} />
      {props.onPress === undefined ? null : <AppIcon name={IconSquareBehindSquare1} color="secondary" size={16} />}
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
      {props.iconStart === undefined ? null : <AppIcon name={props.iconStart} color={tone} size={24} />}
      <Column gap={2} weight={1}>
        <Text text={props.label} size="xs" color={tone} />
        {props.description === undefined ? null : <Text size="md" variant="caption" text={props.description} color="secondary" />}
      </Column>
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
  iconName?: AppIconRef;
  labelScope?: FontPreviewScope;
  selected: boolean;
  onPress: () => void;
}): React.ReactElement {
  return (
    <SettingsItem onPress={props.onPress}>
      {props.iconName ? <AppIcon name={props.iconName} color="link" size={24} /> : null}
      <Column weight={1} {...props.labelScope}>
        <Text text={props.label} size="xs" color="link" truncate />
      </Column>
      {props.selected ? <AppIcon name={IconCheckmark1} color="link" size={24} /> : null}
    </SettingsItem>
  );
}

export function SettingsPage({
  title,
  root = false,
  backTo = SETTINGS_ROUTE,
  back,
  panRef,
  keyboardShouldPersistTaps,
  trailing,
  children,
}: {
  title: string;
  root?: boolean;
  backTo?: string;
  back?: boolean;
  panRef?: SimultaneousRefs;
  keyboardShouldPersistTaps?: 'handled';
  trailing?: ReactNode;
  children: ReactNode;
}): React.ReactElement {
  const insets = useSafeAreaInsets();
  const actions =
    trailing === undefined ? undefined : (
      <Row weight={1} justify="end">
        {trailing}
      </Row>
    );
  return (
    <Column surface="surface" weight={1}>
      {root ? (
        Platform.OS === 'web' ? (
          <StackHeader title={title} />
        ) : null
      ) : (
        <StackHeader title={title} backTo={backTo} back={back} trailing={actions} />
      )}
      <ScreenScroll
        simultaneousHandlers={panRef}
        keyboardShouldPersistTaps={keyboardShouldPersistTaps}
        contentContainerStyle={{ paddingBottom: 32 + insets.bottom }}
      >
        {children}
      </ScreenScroll>
    </Column>
  );
}

export function SettingsSectionLabel({ children }: { children: string }): React.ReactElement {
  const { text: fg } = usePalette();
  return (
    <Eyebrow color={fg} textTransform="uppercase" style={{ paddingHorizontal: PAGE_GUTTER, paddingTop: 24, paddingBottom: 8 }}>
      {children}
    </Eyebrow>
  );
}

export function SettingsGroup({
  title,
  footnote,
  children,
}: {
  title?: string;
  footnote?: string;
  children: ReactNode;
}): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const listDark = useKitScheme() === 'dark';
  const { border } = usePalette();
  return (
    <Column>
      {title === undefined ? <Column height={24} /> : <SettingsSectionLabel>{title}</SettingsSectionLabel>}
      <Column margin={{ x: PAGE_GUTTER }} radius={BLOCK_RADIUS_DEFAULT} style={{ overflow: 'hidden' }}>
        <Card dark={dark} background={border} padding={0}>
          <ListView dark={listDark}>{children}</ListView>
        </Card>
      </Column>
      {footnote === undefined ? null : (
        <Text
          size="md"
          variant="caption"
          text={footnote}
          color="secondary"
          style={{ paddingHorizontal: PAGE_GUTTER + 16, paddingTop: 8 }}
        />
      )}
    </Column>
  );
}
