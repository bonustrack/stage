import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './filterChips.json';
import { buildView } from '../buildView';
import { FILTER_SELECT } from '../actions';

export interface FilterChip {
  value: string;
  label: string;
  selected?: boolean;
}

export interface FilterChipsParams {
  chips: FilterChip[];
  selectedBackground: Color;
  selectedLabelColor: Color;
  restBackground: Color;
  restLabelColor: Color;
  selectType?: string;
}

export function filterChips(params: FilterChipsParams): RowNode {
  const chips = params.chips.map((chip) => ({
    value: chip.value,
    label: chip.label,
    background: chip.selected === true ? params.selectedBackground : params.restBackground,
    labelColor: chip.selected === true ? params.selectedLabelColor : params.restLabelColor,
  }));
  return buildView(view, {
    chips,
    selectType: params.selectType ?? FILTER_SELECT,
  }) as RowNode;
}
