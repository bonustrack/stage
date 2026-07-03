import type { PopoverNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
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
  const pressType = params.pressType ?? OVERFLOW_MENU_PRESS;
  const items = params.items.map((item) =>
    compact({
      id: item.id,
      label: item.label,
      icon: item.icon,
      danger: item.danger === true ? true : undefined,
      disabled: item.disabled === true ? true : undefined,
      pressType,
    }),
  );
  return {
    type: 'Popover',
    side: 'bottom',
    align: params.align ?? 'end',
    title: params.title ?? 'More',
    trigger: {
      type: 'Icon',
      name: params.icon ?? 'dotsHorizontal',
      size: params.iconSize ?? 22,
    },
    items,
  };
}
