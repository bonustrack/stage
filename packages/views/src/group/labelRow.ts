import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './labelRow.json';
import { buildView } from '../buildView';
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
  const labels = params.labels.map((chip) => ({
    label: chip.label,
    removable: chip.removable === true ? true : undefined,
  }));
  return buildView(view, {
    labels,
    background: params.background,
    removeType: params.removeType ?? LABEL_REMOVE,
  }) as RowNode;
}
