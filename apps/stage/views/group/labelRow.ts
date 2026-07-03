import type { Color, RowNode, WidgetNode } from '@stage-labs/kit/kit';
import { compactList } from '../node';
import { LABEL_REMOVE } from '../actions';

export interface LabelChip {
  label: string;
  removable?: boolean;
}

export interface LabelRowParams {
  labels: LabelChip[];
  background: Color;
  removeType?: string;
}

export function labelRow(params: LabelRowParams): RowNode {
  const removeType = params.removeType ?? LABEL_REMOVE;
  const children = params.labels.map((chip): WidgetNode => {
    const inner = compactList<WidgetNode>([
      { type: 'Text', value: chip.label, size: 'xs' },
      chip.removable === true
        ? {
            type: 'Button',
            iconStart: 'x',
            variant: 'ghost',
            size: 'sm',
            color: 'secondary',
            onClickAction: { type: removeType, payload: { label: chip.label } },
          }
        : undefined,
    ]);
    return {
      type: 'Row',
      align: 'center',
      gap: 6,
      radius: 'full',
      background: params.background,
      padding: { y: 6, left: 12, right: 8 },
      children: inner,
    };
  });
  return { type: 'Row', gap: 8, wrap: 'wrap', align: 'center', children };
}
