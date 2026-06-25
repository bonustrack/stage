import type {
  CheckboxNode,
  ColNode,
  ListViewItemNode,
  TitleNode,
  WidgetNode,
} from '@stage-labs/kit/kit';
import { caption, col, icon, row, text, title } from '../primitives';

export interface SettingsSectionParams {
  title?: string;
  caption?: string;
  children: WidgetNode[];
  gap?: number;
}

export function settingsSection(params: SettingsSectionParams): ColNode {
  const header: WidgetNode[] = [];
  if (params.title !== undefined) {
    header.push(
      caption(params.title.toUpperCase(), { color: 'secondary', size: 'sm' }),
    );
  }
  if (params.caption !== undefined) {
    header.push(caption(params.caption, { color: 'secondary' }));
  }
  return col([...header, ...params.children], { gap: params.gap ?? 8 });
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
  const lead: WidgetNode[] = [];
  if (params.iconStart !== undefined) {
    lead.push(icon(params.iconStart, { color: 'link', size: 'xl' }));
  }
  const trailing: WidgetNode[] = [];
  if (params.value !== undefined) {
    trailing.push(text(params.value, { color: 'secondary', truncate: true }));
  }
  trailing.push(
    icon(params.iconEnd ?? 'chevron-right', { color: 'secondary', size: 'lg' }),
  );

  const item: ListViewItemNode = {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      ...lead,
      col([text(params.label, { size: 'xl', color: 'link', truncate: true })], {
        flex: 1,
      }),
      ...trailing,
    ],
  };
  if (params.pressType !== undefined) {
    item.onClickAction = { type: params.pressType, payload: params.payload ?? {} };
  }
  return item;
}

export interface SettingsToggleRowParams {
  label: string;
  name: string;
  checked: boolean;
  description?: string;
  changeType?: string;
}

export function settingsToggleRow(
  params: SettingsToggleRowParams,
): ListViewItemNode {
  const checkbox: CheckboxNode = {
    type: 'Checkbox',
    name: params.name,
    defaultChecked: params.checked,
  };
  if (params.changeType !== undefined) {
    checkbox.onChangeAction = {
      type: params.changeType,
      payload: { name: params.name },
    };
  }
  const labelCol: WidgetNode[] = [
    text(params.label, { weight: 'semibold', size: 'md', color: 'text' }),
  ];
  if (params.description !== undefined) {
    labelCol.push(caption(params.description, { color: 'secondary' }));
  }
  return {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [col(labelCol, { gap: 2, flex: 1 }), checkbox],
  };
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
  const item: ListViewItemNode = {
    type: 'ListViewItem',
    align: 'center',
    gap: 12,
    children: [
      col([text(params.label, { size: 'md', color: 'secondary' })], { flex: 1 }),
      text(params.value, { size: 'md', color: 'text', truncate: true }),
      ...(params.copyType !== undefined
        ? [icon('copy', { color: 'secondary', size: 'sm' })]
        : []),
    ],
  };
  if (params.copyType !== undefined) {
    item.onClickAction = {
      type: params.copyType,
      payload: { label: params.label, value: params.value, ...params.payload },
    };
  }
  return item;
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
  const lead: WidgetNode[] = [];
  if (params.iconStart !== undefined) {
    lead.push(icon(params.iconStart, { color: tone, size: 'xl' }));
  }
  const labelCol: WidgetNode[] = [
    text(params.label, { size: 'md', weight: 'semibold', color: tone }),
  ];
  if (params.description !== undefined) {
    labelCol.push(caption(params.description, { color: 'secondary' }));
  }
  return {
    type: 'ListViewItem',
    align: params.description !== undefined ? 'start' : 'center',
    gap: 12,
    onClickAction: { type: params.clickType, payload: params.payload ?? {} },
    children: [...lead, col(labelCol, { gap: 2, flex: 1 })],
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
