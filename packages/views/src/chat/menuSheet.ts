import type { ListViewNode } from '@stage-labs/kit/kit';
import view from './menuSheet.json';
import { buildView } from '../buildView';
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
  const items = params.items.map((item) => {
    const color = item.danger === true ? 'danger' : undefined;
    return {
      id: item.id,
      label: item.label,
      icon: item.icon,
      hasIcon: item.icon !== undefined || undefined,
      iconColor: color ?? 'secondary',
      labelColor: color,
      pressType: item.pressType ?? MENU_ITEM_PRESS,
    };
  });
  return (buildView(view, { items }) as ListViewNode);
}
