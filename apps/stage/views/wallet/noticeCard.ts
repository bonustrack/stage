import type { ColNode, TextNode, ThemeColor, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';

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
  const actions = params.actions ?? [];
  const colChildren = compactList<WidgetNode>([
    compact<TextNode>({
      type: 'Text',
      value: params.title,
      weight: 'semibold',
      size: 'md',
      color: params.titleColor,
    }),
    params.description !== undefined
      ? { type: 'Caption', value: params.description, color: 'secondary' }
      : undefined,
  ]);
  const rowChildren = compactList<WidgetNode>([
    params.icon !== undefined
      ? compact({
          type: 'Icon' as const,
          name: params.icon,
          color: params.iconColor,
          size: 'lg' as const,
        })
      : undefined,
    { type: 'Col', gap: 2, flex: 1, children: colChildren },
  ]);
  const children = compactList<WidgetNode>([
    { type: 'Row', align: 'start', gap: 12, children: rowChildren },
    actions.length > 0
      ? {
          type: 'Col',
          gap: 8,
          children: actions.map((action) =>
            compact({
              type: 'Button' as const,
              label: action.label,
              block: true,
              variant: action.variant,
              onClickAction: { type: action.pressType, payload: action.payload ?? {} },
            }),
          ),
        }
      : undefined,
  ]);
  return { type: 'Col', gap: params.gap ?? 12, children };
}
