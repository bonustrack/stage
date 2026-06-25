import type { Color, RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
import { PROFILE_ROUND_PRESS } from '../actions';

export interface ProfileRoundAction {
  action: string;
  icon: string;
  label: string;
  disabled?: boolean;
}

export interface ProfileActionsRowParams {
  actions: ProfileRoundAction[];
  border: Color;
  fg: Color;
  pressType?: string;
}

export function profileActionsRow(params: ProfileActionsRowParams): RowNode {
  const pressType = params.pressType ?? PROFILE_ROUND_PRESS;
  const children = params.actions.map((a): WidgetNode => ({
    type: 'Col',
    align: 'center',
    gap: 6,
    children: [
      compact({
        type: 'Button' as const,
        iconStart: a.icon,
        iconPx: 22,
        variant: 'solid' as const,
        size: 'xl' as const,
        pill: true,
        background: params.border,
        foreground: params.fg,
        disabled: a.disabled === true ? true : undefined,
        onClickAction: { type: pressType, payload: { action: a.action } },
      }),
      {
        type: 'Text',
        value: a.label,
        weight: 'semibold',
        size: 'md',
        color: params.fg,
        truncate: true,
      },
    ],
  }));
  return {
    type: 'Row',
    gap: 12,
    justify: 'start',
    padding: { top: 18 },
    children,
  };
}
