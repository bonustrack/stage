import type { ListViewItemNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { PROFILE_INFO_PRESS } from '../actions';

export interface InfoRowParams {
  label: string;
  value: string;
  copyType?: string;
  payload?: Record<string, unknown>;
}

export function infoRow(params: InfoRowParams): ListViewItemNode {
  const pressType = params.copyType ?? PROFILE_INFO_PRESS;
  const children = compactList<WidgetNode>([
    {
      type: 'Col',
      flex: 1,
      gap: 4,
      children: [
        { type: 'Caption', value: params.label, color: 'secondary' },
        { type: 'Text', value: params.value, size: 'sm', truncate: true },
      ],
    },
    params.copyType !== undefined
      ? { type: 'Icon', name: 'copy', color: 'secondary', size: 'sm' }
      : undefined,
  ]);
  return {
    type: 'ListViewItem',
    onClickAction: {
      type: pressType,
      payload: { label: params.label, value: params.value, ...params.payload },
    },
    align: 'center',
    gap: 12,
    children,
  };
}
