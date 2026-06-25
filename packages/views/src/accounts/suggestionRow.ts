import type { Color, ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { SUGGESTION_TOGGLE } from '../actions';

export interface SuggestionRowParams {
  address: string;
  name: string;
  avatarUri: string;
  handle?: string;
  selected?: boolean;
  checkBackground?: Color;
  toggleType?: string;
}

export function suggestionRow(params: SuggestionRowParams): ListViewItemNode {
  const selected = params.selected === true;
  const hasHandle = params.handle !== undefined && params.handle !== '';
  const checkBackground = params.checkBackground ?? 'primary';
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
    { type: 'Image', src: params.avatarUri, size: 36, radius: 'full' },
    { type: 'Col', gap: 1, flex: 1, children: colChildren },
    selected
      ? {
          type: 'Row',
          width: 24,
          height: 24,
          radius: 'lg',
          background: checkBackground,
          align: 'center',
          justify: 'center',
          children: [{ type: 'Icon', name: 'check', size: 14, color: '#fff' }],
        }
      : undefined,
    !selected
      ? {
          type: 'Row',
          width: 24,
          height: 24,
          radius: 'lg',
          align: 'center',
          justify: 'center',
          border: { size: 2, color: checkBackground },
          children: [],
        }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: params.toggleType ?? SUGGESTION_TOGGLE,
      payload: { address: params.address },
    },
    align: 'center',
    gap: 10,
    children: [{ type: 'Row', align: 'center', gap: 10, flex: 1, children: rowChildren }],
  };
}
