import type { Color, ScrollRowNode } from '@stage-labs/kit/kit';
import view from './labelBar.json';
import { buildView } from '../buildView';
import { LABEL_CHIP_PRESS } from '../actions';

export interface LabelBarChip {
  value: string;
  label: string;
  selected?: boolean;
}

export interface LabelBarParams {
  chips: LabelBarChip[];
  selectedBackground: Color;
  selectedLabelColor: Color;
  restBackground: Color;
  restLabelColor: Color;
  pressType?: string;
}

export function labelBar(params: LabelBarParams): ScrollRowNode {
  const chips = params.chips.map((chip) => ({
    value: chip.value,
    label: chip.label,
    background:
      chip.selected === true ? params.selectedBackground : params.restBackground,
    labelColor:
      chip.selected === true ? params.selectedLabelColor : params.restLabelColor,
  }));
  return buildView(view, {
    chips,
    pressType: params.pressType ?? LABEL_CHIP_PRESS,
  }) as ScrollRowNode;
}
