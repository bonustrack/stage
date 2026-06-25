import type { ColNode } from '@stage-labs/kit/kit';
import view from './profileHeader.json';
import { buildView } from '../buildView';
import { PROFILE_ACTION_PRESS } from '../actions';

export interface ProfileStat {
  label: string;
  value: string;
}

export interface ProfileAction {
  label: string;
  icon?: string;
  payload?: Record<string, unknown>;
}

export interface ProfileHeaderParams {
  name: string;
  avatarUri?: string;
  handle?: string;
  bio?: string;
  stats?: ProfileStat[];
  actions?: ProfileAction[];
  actionPressType?: string;
  align?: 'start' | 'center' | 'end';
}

function present(value: string | undefined): true | undefined {
  return value !== undefined && value !== '' ? true : undefined;
}

function notEmpty(value: { length: number } | undefined): true | undefined {
  return value !== undefined && value.length > 0 ? true : undefined;
}

export function profileHeader(params: ProfileHeaderParams): ColNode {
  const actions = params.actions?.map((a) => ({
    label: a.label,
    icon: a.icon,
    payload: a.payload ?? {},
  }));
  const align = params.align ?? 'start';
  return buildView(view, {
    align,
    textAlign: align === 'center' ? 'center' : 'start',
    name: params.name,
    avatarUri: params.avatarUri,
    handle: params.handle,
    bio: params.bio,
    stats: params.stats,
    actions,
    hasHandle: present(params.handle),
    hasBio: present(params.bio),
    hasStats: notEmpty(params.stats),
    hasActions: notEmpty(actions),
    actionPressType: params.actionPressType ?? PROFILE_ACTION_PRESS,
  }) as ColNode;
}
