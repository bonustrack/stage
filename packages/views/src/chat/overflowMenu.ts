import type { PopoverNode } from '@stage-labs/kit/kit';
import view from './overflowMenu.json';
import { buildView } from '../buildView';
import { OVERFLOW_MENU_PRESS } from '../actions';

export interface OverflowMenuItem {
  id: string;
  label: string;
  icon?: string;
  danger?: boolean;
  disabled?: boolean;
}

export interface OverflowMenuParams {
  items: OverflowMenuItem[];
  icon?: string;
  iconSize?: number;
  align?: 'start' | 'end';
  title?: string;
  pressType?: string;
}

export function overflowMenu(params: OverflowMenuParams): PopoverNode {
  const items = params.items.map((item) => ({
    id: item.id,
    label: item.label,
    icon: item.icon,
    danger: item.danger === true ? true : undefined,
    disabled: item.disabled === true ? true : undefined,
  }));
  return buildView(view, {
    items,
    icon: params.icon ?? 'dotsHorizontal',
    iconSize: params.iconSize ?? 22,
    align: params.align ?? 'end',
    title: params.title ?? 'More',
    pressType: params.pressType ?? OVERFLOW_MENU_PRESS,
  }) as PopoverNode;
}
