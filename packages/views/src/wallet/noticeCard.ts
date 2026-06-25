import type { ColNode, ThemeColor } from '@stage-labs/kit/kit';
import view from './noticeCard.json';
import { buildView } from '../buildView';

export interface NoticeAction {
  label: string;
  pressType: string;
  variant?: 'solid' | 'soft' | 'outline' | 'ghost';
  payload?: Record<string, unknown>;
}

export interface NoticeCardParams {
  icon?: string;
  iconColor?: ThemeColor;
  title: string;
  titleColor?: ThemeColor | 'text' | 'secondary' | 'danger' | 'link';
  description?: string;
  actions?: NoticeAction[];
  gap?: number;
}

export function noticeCard(params: NoticeCardParams): ColNode {
  const actions = (params.actions ?? []).map((action) => ({
    label: action.label,
    pressType: action.pressType,
    variant: action.variant,
    payload: action.payload ?? {},
  }));
  return (buildView(view, {
    icon: params.icon,
    iconColor: params.iconColor,
    title: params.title,
    titleColor: params.titleColor,
    description: params.description,
    gap: params.gap ?? 12,
    actions,
    hasActions:
      params.actions !== undefined && params.actions.length > 0
        ? true
        : undefined,
  }) as ColNode);
}
