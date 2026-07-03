import type { ListViewItemNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { BANNER_PRESS } from '../actions';

export interface BannerParams {
  label: string;
  icon?: string;
  iconColor?: ThemeColor | 'link' | 'secondary' | 'danger' | 'success';
  labelColor?: ThemeColor | 'link' | 'secondary' | 'danger' | 'success';
  showChevron?: boolean;
  pressType?: string;
  payload?: Record<string, unknown>;
}

export function banner(params: BannerParams): ListViewItemNode {
  const showChevron = params.showChevron !== false;
  const rowChildren = compactList<WidgetNode>([
    params.icon !== undefined
      ? {
          type: 'Icon',
          name: params.icon,
          color: params.iconColor ?? 'link',
          size: 'md',
        }
      : undefined,
    {
      type: 'Col',
      flex: 1,
      children: [
        {
          type: 'Text',
          value: params.label,
          weight: 'semibold',
          size: 'lg',
          color: params.labelColor ?? 'link',
          truncate: true,
        },
      ],
    },
    showChevron
      ? { type: 'Icon', name: 'chevron-right', color: 'secondary', size: 'sm' }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: params.pressType ?? BANNER_PRESS,
      payload: params.payload ?? {},
    },
    align: 'center',
    gap: 10,
    children: [{ type: 'Row', align: 'center', gap: 10, flex: 1, children: rowChildren }],
  };
}
