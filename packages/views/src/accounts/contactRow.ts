import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { CONTACT_PRESS } from '../actions';

export interface ContactRowParams {
  name: string;
  avatarUri: string;
  handle?: string;
  trailingBadge?: string;
  pressType?: string;
  payload?: Record<string, unknown>;
}

export function contactRow(params: ContactRowParams): ListViewItemNode {
  const hasHandle = params.handle !== undefined && params.handle !== '';
  const colChildren = compactList<WidgetNode>([
    { type: 'Text', value: params.name, weight: 'semibold', truncate: true },
    hasHandle
      ? {
          type: 'Caption',
          value: params.handle ?? '',
          color: 'secondary',
          truncate: true,
        }
      : undefined,
  ]);
  const rowChildren = compactList<WidgetNode>([
    { type: 'Image', src: params.avatarUri, size: 40, radius: 'full' },
    { type: 'Col', gap: 2, flex: 1, children: colChildren },
    params.trailingBadge !== undefined
      ? {
          type: 'Badge',
          label: params.trailingBadge,
          color: 'secondary',
          variant: 'soft',
          size: 'sm',
          pill: true,
        }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: params.pressType ?? CONTACT_PRESS,
      payload: params.payload ?? {},
    },
    align: 'center',
    gap: 12,
    children: [{ type: 'Row', align: 'center', gap: 12, flex: 1, children: rowChildren }],
  };
}
