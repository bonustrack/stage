import type { ColNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { EMPTY_STATE_PRESS } from '../actions';
import { caption } from '../primitives';

export interface EmptyStateParams {
  icon?: string;
  title: string;
  caption?: string;
  actionLabel?: string;
  actionId?: string;
}

function present(value: string | undefined): boolean {
  return value !== undefined && value !== '';
}

function iconNode(params: EmptyStateParams): WidgetNode | undefined {
  if (!present(params.icon)) return undefined;
  return { type: 'Icon', name: params.icon ?? '', size: '3xl', color: 'secondary' };
}

function captionNode(params: EmptyStateParams): WidgetNode | undefined {
  if (!present(params.caption)) return undefined;
  return {
    type: 'Caption',
    value: params.caption ?? '',
    color: 'secondary',
    textAlign: 'center',
  };
}

function actionNode(params: EmptyStateParams): WidgetNode | undefined {
  if (!present(params.actionLabel)) return undefined;
  return {
    type: 'Button',
    label: params.actionLabel ?? '',
    variant: 'soft',
    size: 'sm',
    onClickAction: {
      type: EMPTY_STATE_PRESS,
      payload: params.actionId !== undefined ? { id: params.actionId } : {},
    },
  };
}

export function emptyState(params: EmptyStateParams): ColNode {
  const children = compactList<WidgetNode>([
    iconNode(params),
    { type: 'Text', value: params.title, weight: 'semibold', textAlign: 'center' },
    captionNode(params),
    actionNode(params),
  ]);
  return {
    type: 'Col',
    align: 'center',
    justify: 'center',
    gap: 8,
    padding: 24,
    children,
  };
}

export function sectionHeader(params: { title: string }): WidgetNode {
  return caption(params.title.toUpperCase(), {
    color: 'secondary',
    weight: 'semibold',
  });
}
