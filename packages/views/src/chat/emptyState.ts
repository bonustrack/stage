import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import view from './emptyState.json';
import { buildView } from '../buildView';
import { EMPTY_STATE_PRESS } from '../actions';
import { caption } from '../primitives';

export interface EmptyStateParams {
  icon?: string;
  title: string;
  caption?: string;
  actionLabel?: string;
  actionId?: string;
}

export function emptyState(params: EmptyStateParams): ColNode {
  return (buildView(view, {
    emptyPressType: EMPTY_STATE_PRESS,
    icon: params.icon,
    title: params.title,
    caption: params.caption,
    actionLabel: params.actionLabel,
    actionId: params.actionId,
    hasIcon: (params.icon !== undefined && params.icon !== '') || undefined,
    hasCaption:
      (params.caption !== undefined && params.caption !== '') || undefined,
    hasAction:
      (params.actionLabel !== undefined && params.actionLabel !== '') ||
      undefined,
  }) as ColNode);
}

export function sectionHeader(params: { title: string }): WidgetNode {
  return caption(params.title.toUpperCase(), {
    color: 'secondary',
    weight: 'semibold',
  });
}
