import type { ListViewItemNode } from '@stage-labs/kit/kit';
import view from './infoRow.json';
import { buildView } from '../buildView';
import { PROFILE_INFO_PRESS } from '../actions';

export interface InfoRowParams {
  label: string;
  value: string;
  copyType?: string;
  payload?: Record<string, unknown>;
}

export function infoRow(params: InfoRowParams): ListViewItemNode {
  const pressType = params.copyType ?? PROFILE_INFO_PRESS;
  return buildView(view, {
    label: params.label,
    value: params.value,
    hasCopy: params.copyType !== undefined || undefined,
    clickAction: {
      type: pressType,
      payload: { label: params.label, value: params.value, ...params.payload },
    },
  }) as ListViewItemNode;
}
