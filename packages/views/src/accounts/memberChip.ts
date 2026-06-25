import type { Color, RowNode, WidgetNode } from '@stage-labs/kit/kit';
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
  const children: WidgetNode[] = [
    { type: 'Image', src: params.avatarUri, size: 22, radius: 'full' },
    { type: 'Text', value: params.name, size: 'sm', weight: 'medium', truncate: true },
  ];
  if (params.removable === true) {
    children.push({
      type: 'Button',
      iconStart: 'x',
      variant: 'ghost',
      size: 'sm',
      color: 'secondary',
      onClickAction: {
        type: params.removeType ?? MEMBER_CHIP_REMOVE,
        payload: { id: params.id },
      },
    });
  }
  return {
    type: 'Row',
    align: 'center',
    gap: 6,
    radius: 'full',
    background: params.background ?? 'rgba(0,0,0,0.06)',
    padding: { y: 4, left: 6, right: 8 },
    children,
  };
}
