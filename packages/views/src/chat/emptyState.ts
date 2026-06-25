import type { ColNode, WidgetNode } from '@stage-labs/kit/chatkit';
import { EMPTY_STATE_PRESS } from '../actions';
import { button, caption, col, icon, text } from '../primitives';

export interface EmptyStateParams {
  icon?: string;
  title: string;
  caption?: string;
  actionLabel?: string;
  actionId?: string;
}

export function emptyState(params: EmptyStateParams): ColNode {
  const children: WidgetNode[] = [];
  if (params.icon !== undefined && params.icon !== '') {
    children.push(icon(params.icon, { size: '3xl', color: 'secondary' }));
  }
  children.push(text(params.title, { weight: 'semibold', textAlign: 'center' }));
  if (params.caption !== undefined && params.caption !== '') {
    children.push(caption(params.caption, { color: 'secondary', textAlign: 'center' }));
  }
  if (params.actionLabel !== undefined && params.actionLabel !== '') {
    children.push(
      button({
        label: params.actionLabel,
        variant: 'soft',
        size: 'sm',
        onClickAction: {
          type: EMPTY_STATE_PRESS,
          payload: { id: params.actionId },
        },
      }),
    );
  }
  return col(children, { align: 'center', justify: 'center', gap: 8, padding: 24 });
}

export function sectionHeader(params: { title: string }): WidgetNode {
  return caption(params.title.toUpperCase(), {
    color: 'secondary',
    weight: 'semibold',
  });
}
