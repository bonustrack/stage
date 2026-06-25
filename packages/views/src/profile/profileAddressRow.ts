import type { Color, PressableNode } from '@stage-labs/kit/kit';
import view from './profileAddressRow.json';
import { buildView } from '../buildView';
import { PROFILE_ADDRESS_COPY } from '../actions';

export interface ProfileAddressRowParams {
  address: string;
  label: string;
  color: Color;
  pressType?: string;
}

export function profileAddressRow(params: ProfileAddressRowParams): PressableNode {
  return buildView(view, {
    address: params.address,
    label: params.label,
    color: params.color,
    pressType: params.pressType ?? PROFILE_ADDRESS_COPY,
  }) as PressableNode;
}
