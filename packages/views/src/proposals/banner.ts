import type { ListViewItemNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './banner.json';
import { buildView } from '../buildView';
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
  return buildView(view, {
    label: params.label,
    icon: params.icon,
    iconColor: params.iconColor ?? 'link',
    labelColor: params.labelColor ?? 'link',
    showChevron: params.showChevron !== false || undefined,
    pressType: params.pressType ?? BANNER_PRESS,
    payload: params.payload ?? {},
  }) as ListViewItemNode;
}
