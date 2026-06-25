import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact, compactList } from '../node';
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

function present(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

type TextAlign = 'start' | 'center';

function textRow(
  value: string | undefined,
  size: 'md' | 'sm',
  textAlign: TextAlign,
): WidgetNode | undefined {
  if (!present(value)) return undefined;
  return { type: 'Text', value: value ?? '', size, color: 'secondary', textAlign };
}

function statsRow(stats: ProfileStat[]): WidgetNode | undefined {
  if (stats.length === 0) return undefined;
  return {
    type: 'Row',
    gap: 20,
    align: 'center',
    padding: { top: 4 },
    children: stats.map((stat) => ({
      type: 'Col',
      gap: 0,
      align: 'start',
      children: [
        { type: 'Text', value: stat.value, weight: 'semibold', size: 'lg' },
        { type: 'Caption', value: stat.label, color: 'secondary' },
      ],
    })),
  };
}

function actionsRow(
  actions: ProfileAction[],
  actionPressType: string,
): WidgetNode | undefined {
  if (actions.length === 0) return undefined;
  return {
    type: 'Row',
    gap: 12,
    align: 'center',
    padding: { top: 8 },
    children: actions.map((action) =>
      compact({
        type: 'Button' as const,
        label: action.label,
        iconStart: action.icon,
        variant: 'soft' as const,
        color: 'primary' as const,
        onClickAction: { type: actionPressType, payload: action.payload ?? {} },
      }),
    ),
  };
}

export function profileHeader(params: ProfileHeaderParams): ColNode {
  const align = params.align ?? 'start';
  const textAlign: TextAlign = align === 'center' ? 'center' : 'start';
  const actionPressType = params.actionPressType ?? PROFILE_ACTION_PRESS;
  const children = compactList<WidgetNode>([
    params.avatarUri !== undefined
      ? { type: 'Image', src: params.avatarUri, size: 88, radius: 'full' }
      : undefined,
    { type: 'Text', value: params.name, weight: 'semibold', size: '4xl', textAlign },
    textRow(params.handle, 'md', textAlign),
    textRow(params.bio, 'sm', textAlign),
    statsRow(params.stats ?? []),
    actionsRow(params.actions ?? [], actionPressType),
  ]);
  return { type: 'Col', gap: 6, align, children };
}
