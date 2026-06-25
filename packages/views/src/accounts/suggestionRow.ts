import type { Color, ListViewItemNode } from '@stage-labs/kit/kit';
import view from './suggestionRow.json';
import { buildView } from '../buildView';
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
  return buildView(view, {
    address: params.address,
    name: params.name,
    avatarUri: params.avatarUri,
    handle: params.handle,
    hasHandle: (params.handle !== undefined && params.handle !== '') || undefined,
    selected: selected || undefined,
    unselected: !selected || undefined,
    checkBackground: params.checkBackground ?? 'primary',
    toggleType: params.toggleType ?? SUGGESTION_TOGGLE,
  }) as ListViewItemNode;
}
