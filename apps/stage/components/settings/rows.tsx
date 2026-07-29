
import type { ReactNode } from 'react';
import { Caption } from '@stage-labs/kit/react-native/caption';
import { Checkbox } from '@stage-labs/kit/react-native/checkbox';
import { ListView, ListViewItem } from '@stage-labs/kit/react-native/list-view';
import { Switch } from '@stage-labs/kit/react-native/switch';
import { Text } from '@stage-labs/kit/react-native/text';
import { useKitScheme } from '@stage-labs/kit/react-native/theme-context';
import { Col } from '../layout';
import { AppIcon } from '../widgets';

export function SettingsList({ children }: { children: ReactNode }): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return <ListView dark={dark}>{children}</ListView>;
}

export interface SettingsNavRowProps {
  label: string;
  value?: string;
  iconStart?: string;
  iconEnd?: string;
  onPress?: () => void;
}

export function SettingsNavRow(props: SettingsNavRowProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark} onPress={props.onPress}>
      {props.iconStart === undefined ? null : (
        <AppIcon name={props.iconStart} color="link" size={28} />
      )}
      <Col flex={1}>
        <Text value={props.label} size="xl" color="link" truncate />
      </Col>
      {props.value === undefined ? null : (
        <Text value={props.value} color="secondary" truncate />
      )}
      <AppIcon name={props.iconEnd ?? 'chevronRight'} color="secondary" size={24} />
    </ListViewItem>
  );
}

export interface SettingsToggleRowProps {
  label: string;
  name: string;
  checked: boolean;
  description?: string;
  onChange?: (checked: boolean) => void;
  control?: 'switch' | 'checkbox';
}

export function SettingsToggleRow(props: SettingsToggleRowProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark}>
      <Col gap={2} flex={1}>
        <Text value={props.label} weight="semibold" size="md" color="text" />
        {props.description === undefined ? null : (
          <Caption value={props.description} color="secondary" />
        )}
      </Col>
      {props.control === 'switch' ? (
        <Switch name={props.name} checked={props.checked} dark={dark} onChange={props.onChange} />
      ) : (
        <Checkbox
          name={props.name}
          defaultChecked={props.checked}
          dark={dark}
          onChange={props.onChange}
        />
      )}
    </ListViewItem>
  );
}

export interface SettingsValueRowProps {
  label: string;
  value: string;
  onPress?: () => void;
}

export function SettingsValueRow(props: SettingsValueRowProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark} onPress={props.onPress}>
      <Col flex={1}>
        <Text value={props.label} size="md" color="secondary" />
      </Col>
      <Text value={props.value} size="md" color="text" truncate />
      {props.onPress === undefined ? null : (
        <AppIcon name="copy" color="secondary" size={16} />
      )}
    </ListViewItem>
  );
}

export interface SettingsButtonRowProps {
  label: string;
  description?: string;
  iconStart?: string;
  onPress: () => void;
  danger?: boolean;
}

export function SettingsButtonRow(props: SettingsButtonRowProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  const tone = props.danger === true ? 'danger' : 'link';
  return (
    <ListViewItem
      align={props.description === undefined ? 'center' : 'start'}
      gap={12}
      dark={dark}
      onPress={props.onPress}
    >
      {props.iconStart === undefined ? null : (
        <AppIcon name={props.iconStart} color={tone} size={28} />
      )}
      <Col gap={2} flex={1}>
        <Text value={props.label} size="md" weight="semibold" color={tone} />
        {props.description === undefined ? null : (
          <Caption value={props.description} color="secondary" />
        )}
      </Col>
    </ListViewItem>
  );
}

export interface SettingsThemeRowProps {
  label: string;
  iconName: string;
  selected: boolean;
  iconColor?: string;
  onPress: () => void;
}

export function SettingsThemeRow(props: SettingsThemeRowProps): React.ReactElement {
  const dark = useKitScheme() === 'dark';
  return (
    <ListViewItem align="center" gap={12} dark={dark} onPress={props.onPress}>
      <AppIcon name={props.iconName} color={props.iconColor ?? 'link'} size={28} />
      <Col flex={1}>
        <Text value={props.label} size="xl" color="text" truncate />
      </Col>
      {props.selected ? <AppIcon name="check" color="link" size={24} /> : null}
    </ListViewItem>
  );
}
