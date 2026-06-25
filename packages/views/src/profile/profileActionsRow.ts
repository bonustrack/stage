import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './profileActionsRow.json';
import { buildView } from '../buildView';
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
  const actions = params.actions.map((a) => ({
    action: a.action,
    icon: a.icon,
    label: a.label,
    disabled: a.disabled === true ? true : undefined,
  }));
  return buildView(view, {
    actions,
    border: params.border,
    fg: params.fg,
    pressType: params.pressType ?? PROFILE_ROUND_PRESS,
  }) as RowNode;
}
