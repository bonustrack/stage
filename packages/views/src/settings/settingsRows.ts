import type {
  ColNode,
  ListViewItemNode,
  TitleNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import sectionView from './settingsSection.json';
import navRowView from './settingsNavRow.json';
import toggleRowView from './settingsToggleRow.json';
import valueRowView from './settingsValueRow.json';
import buttonRowView from './settingsButtonRow.json';
import { buildView } from '../buildView';
import { caption, col, icon, row, text, title } from '../primitives';

export interface SettingsSectionParams {
  title?: string;
  caption?: string;
  children: WidgetNode[];
  gap?: number;
}

export function settingsSection(params: SettingsSectionParams): ColNode {
  return (buildView(sectionView, {
    gap: params.gap ?? 8,
    hasTitle: params.title !== undefined || undefined,
    titleUpper: params.title?.toUpperCase(),
    hasCaption: params.caption !== undefined || undefined,
    caption: params.caption,
    children: params.children,
  }) as ColNode);
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
  return (buildView(navRowView, {
    label: params.label,
    value: params.value,
    iconStart: params.iconStart,
    iconEnd: params.iconEnd ?? 'chevron-right',
    hasValue: params.value !== undefined || undefined,
    clickAction:
      params.pressType !== undefined
        ? { type: params.pressType, payload: params.payload ?? {} }
        : undefined,
  }) as ListViewItemNode);
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
  return (buildView(toggleRowView, {
    label: params.label,
    name: params.name,
    checked: params.checked,
    description: params.description,
    hasDescription: params.description !== undefined || undefined,
    useSwitch: useSwitch || undefined,
    useCheckbox: useSwitch ? undefined : true,
    changeAction:
      params.changeType !== undefined
        ? { type: params.changeType, payload: { name: params.name } }
        : undefined,
  }) as ListViewItemNode);
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
  return (buildView(valueRowView, {
    label: params.label,
    value: params.value,
    hasCopy: params.copyType !== undefined || undefined,
    clickAction:
      params.copyType !== undefined
        ? {
            type: params.copyType,
            payload: { label: params.label, value: params.value, ...params.payload },
          }
        : undefined,
  }) as ListViewItemNode);
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
  return (buildView(buttonRowView, {
    label: params.label,
    description: params.description,
    iconStart: params.iconStart,
    clickType: params.clickType,
    payload: params.payload ?? {},
    tone: params.danger === true ? 'danger' : 'link',
    align: params.description !== undefined ? 'start' : 'center',
    hasDescription: params.description !== undefined || undefined,
  }) as ListViewItemNode);
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
