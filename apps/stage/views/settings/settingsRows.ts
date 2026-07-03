import type {
  ColNode,
  ListViewItemNode,
  TitleNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
import { caption, col, icon, row, text, title } from '../primitives';
import { SETTINGS_THEME_SELECT } from '../actions';

export interface SettingsSectionParams {
  title?: string;
  caption?: string;
  children: WidgetNode[];
  gap?: number;
}

export function settingsSection(params: SettingsSectionParams): ColNode {
  const children = compactList<WidgetNode>([
    params.title !== undefined
      ? {
          type: 'Caption',
          value: params.title.toUpperCase(),
          color: 'secondary',
          size: 'sm',
        }
      : undefined,
    params.caption !== undefined
      ? { type: 'Caption', value: params.caption, color: 'secondary' }
      : undefined,
    ...params.children,
  ]);
  return { type: 'Col', gap: params.gap ?? 8, children };
}

export interface SettingsNavRowParams {
  label: string;
  value?: string;
  iconStart?: string;
  iconEnd?: string;
  pressType?: string;
  payload?: Record<string, unknown>;
}

export function settingsNavRow(params: SettingsNavRowParams): ListViewItemNode {
  const children = compactList<WidgetNode>([
    params.iconStart !== undefined
      ? { type: 'Icon', name: params.iconStart, color: 'link', size: 'xl' }
      : undefined,
    {
      type: 'Col',
      flex: 1,
      children: [
        { type: 'Text', value: params.label, size: 'xl', color: 'link', truncate: true },
      ],
    },
    params.value !== undefined
      ? { type: 'Text', value: params.value, color: 'secondary', truncate: true }
      : undefined,
    { type: 'Icon', name: params.iconEnd ?? 'chevron-right', color: 'secondary', size: 'lg' },
  ]);
  return compact<ListViewItemNode>({
    type: 'ListViewItem',
    onClickAction:
      params.pressType !== undefined
        ? { type: params.pressType, payload: params.payload ?? {} }
        : undefined,
    align: 'center',
    gap: 12,
    children,
  });
}

export interface SettingsToggleRowParams {
  label: string;
  name: string;
  checked: boolean;
  description?: string;
  changeType?: string;
  control?: 'switch' | 'checkbox';
}

export function settingsToggleRow(
  params: SettingsToggleRowParams,
): ListViewItemNode {
  const useSwitch = params.control === 'switch';
  const changeAction =
    params.changeType !== undefined
      ? { type: params.changeType, payload: { name: params.name } }
      : undefined;
  const colChildren = compactList<WidgetNode>([
    { type: 'Text', value: params.label, weight: 'semibold', size: 'md', color: 'text' },
    params.description !== undefined
      ? { type: 'Caption', value: params.description, color: 'secondary' }
      : undefined,
  ]);
  const children = compactList<WidgetNode>([
    { type: 'Col', gap: 2, flex: 1, children: colChildren },
    useSwitch
      ? compact({
          type: 'Switch' as const,
          name: params.name,
          checked: params.checked,
          onChangeAction: changeAction,
        })
      : undefined,
    !useSwitch
      ? compact({
          type: 'Checkbox' as const,
          name: params.name,
          defaultChecked: params.checked,
          onChangeAction: changeAction,
        })
      : undefined,
  ]);
  return { type: 'ListViewItem', align: 'center', gap: 12, children };
}

export interface SettingsValueRowParams {
  label: string;
  value: string;
  copyType?: string;
  payload?: Record<string, unknown>;
}

export function settingsValueRow(
  params: SettingsValueRowParams,
): ListViewItemNode {
  const children = compactList<WidgetNode>([
    {
      type: 'Col',
      flex: 1,
      children: [
        { type: 'Text', value: params.label, size: 'md', color: 'secondary' },
      ],
    },
    { type: 'Text', value: params.value, size: 'md', color: 'text', truncate: true },
    params.copyType !== undefined
      ? { type: 'Icon', name: 'copy', color: 'secondary', size: 'sm' }
      : undefined,
  ]);
  return compact<ListViewItemNode>({
    type: 'ListViewItem',
    onClickAction:
      params.copyType !== undefined
        ? {
            type: params.copyType,
            payload: { label: params.label, value: params.value, ...params.payload },
          }
        : undefined,
    align: 'center',
    gap: 12,
    children,
  });
}

export interface SettingsButtonRowParams {
  label: string;
  description?: string;
  iconStart?: string;
  clickType: string;
  payload?: Record<string, unknown>;
  danger?: boolean;
}

export function settingsButtonRow(
  params: SettingsButtonRowParams,
): ListViewItemNode {
  const tone = params.danger === true ? 'danger' : 'link';
  const colChildren = compactList<WidgetNode>([
    { type: 'Text', value: params.label, size: 'md', weight: 'semibold', color: tone },
    params.description !== undefined
      ? { type: 'Caption', value: params.description, color: 'secondary' }
      : undefined,
  ]);
  const children = compactList<WidgetNode>([
    params.iconStart !== undefined
      ? { type: 'Icon', name: params.iconStart, color: tone, size: 'xl' }
      : undefined,
    { type: 'Col', gap: 2, flex: 1, children: colChildren },
  ]);
  return {
    type: 'ListViewItem',
    align: params.description !== undefined ? 'start' : 'center',
    gap: 12,
    onClickAction: { type: params.clickType, payload: params.payload ?? {} },
    children,
  };
}

export interface SettingsThemeRowParams {
  value: string;
  label: string;
  iconName: string;
  selected: boolean;
  iconColor?: string;
}

export function settingsThemeRow(
  params: SettingsThemeRowParams,
): ListViewItemNode {
  const trailing = params.selected
    ? [icon('check', { color: 'link', size: 'lg' })]
    : [];
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    onClickAction: {
      type: SETTINGS_THEME_SELECT,
      payload: { value: params.value },
    },
    children: [
      icon(params.iconName, { color: params.iconColor ?? 'link', size: 'xl' }),
      col([text(params.label, { size: 'xl', color: 'text', truncate: true })], {
        flex: 1,
      }),
      ...trailing,
    ],
  };
}

export function settingsSectionTitle(value: string): TitleNode {
  return title(value, { size: 'lg' });
}

export function settingsListRow(item: ListViewItemNode): {
  type: 'ListView';
  children: ListViewItemNode[];
} {
  return { type: 'ListView', children: [item] };
}

export function settingsRowSelectedIcon(selected: boolean): WidgetNode | undefined {
  return selected ? icon('check', { color: 'link', size: 'lg' }) : undefined;
}

export { row, col, text, caption, title, icon };
