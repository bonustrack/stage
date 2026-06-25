import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './memberChip.json';
import { buildView } from '../buildView';
import { MEMBER_CHIP_REMOVE } from '../actions';

export interface MemberChipParams {
  id: string;
  name: string;
  avatarUri: string;
  background?: Color;
  removable?: boolean;
  removeType?: string;
}

export function memberChip(params: MemberChipParams): RowNode {
  return buildView(view, {
    id: params.id,
    name: params.name,
    avatarUri: params.avatarUri,
    background: params.background ?? 'rgba(0,0,0,0.06)',
    removable: params.removable === true || undefined,
    removeType: params.removeType ?? MEMBER_CHIP_REMOVE,
  }) as RowNode;
}
