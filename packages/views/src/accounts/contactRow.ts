import type { ListViewItemNode } from '@stage-labs/kit/kit';
import view from './contactRow.json';
import { buildView } from '../buildView';
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
  return buildView(view, {
    name: params.name,
    avatarUri: params.avatarUri,
    handle: params.handle,
    trailingBadge: params.trailingBadge,
    hasHandle:
      (params.handle !== undefined && params.handle !== '') || undefined,
    contactPressType: params.pressType ?? CONTACT_PRESS,
    payload: params.payload ?? {},
  }) as ListViewItemNode;
}
