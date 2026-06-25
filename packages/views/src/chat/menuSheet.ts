import type { ListViewItemNode, ListViewNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { MENU_ITEM_PRESS } from '../actions';

export interface MenuSheetItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  pressType?: string;
}

export interface MenuSheetParams {
  items: MenuSheetItem[];
}

export function menuSheet(params: MenuSheetParams): ListViewNode {
  const children = params.items.map((item): ListViewItemNode => {
    const color = item.danger === true ? 'danger' : undefined;
    const rowChildren = compactList<WidgetNode>([
      item.icon !== undefined
        ? { type: 'Icon', name: item.icon, color: color ?? 'secondary' }
        : undefined,
      {
        type: 'Text',
        value: item.label,
        ...(color !== undefined ? { color } : {}),
        weight: 'medium',
      },
    ]);
    return {
      type: 'ListViewItem',
      onClickAction: {
        type: item.pressType ?? MENU_ITEM_PRESS,
        payload: { id: item.id },
      },
      align: 'center',
      gap: 12,
      children: [{ type: 'Row', align: 'center', gap: 12, flex: 1, children: rowChildren }],
    };
  });
  return { type: 'ListView', children };
}
