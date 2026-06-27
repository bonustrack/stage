import type { Color, PressableNode } from '@stage-labs/kit/kit';
import { PROFILE_ADDRESS_COPY } from '../actions';

export interface ProfileAddressRowParams {
  address: string;
  label: string;
  color: Color;
  pressType?: string;
}

export function profileAddressRow(params: ProfileAddressRowParams): PressableNode {
  return {
    type: 'Pressable',
    hitSlop: 8,
    onClickAction: {
      type: params.pressType ?? PROFILE_ADDRESS_COPY,
      payload: { address: params.address },
    },
    children: [{ type: 'Text', value: params.label, size: 'md', color: params.color }],
  };
}
