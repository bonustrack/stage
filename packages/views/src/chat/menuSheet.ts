import type { Color, ListViewNode, WidgetNode } from '@stage-labs/kit/kit';
import { MENU_ITEM_PRESS } from '../actions';
import { icon, row, text } from '../primitives';

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
  return {
    type: 'ListView',
    children: params.items.map((item) => {
      const color: Color | undefined = item.danger === true ? 'danger' : undefined;
      const lead: WidgetNode[] =
        item.icon !== undefined ? [icon(item.icon, { color: color ?? 'secondary' })] : [];
      return {
        type: 'ListViewItem',
        onClickAction: {
          type: item.pressType ?? MENU_ITEM_PRESS,
          payload: { id: item.id },
        },
        align: 'center',
        gap: 12,
        children: [
          row([...lead, text(item.label, { color, weight: 'medium' })], {
            align: 'center',
            gap: 12,
            flex: 1,
          }),
        ],
      };
    }),
  };
}
