import type { Color, ScrollRowNode, WidgetNode } from '@stage-labs/kit/kit';
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
  const pressType = params.pressType ?? LABEL_CHIP_PRESS;
  const children = params.chips.map((chip): WidgetNode => {
    const selected = chip.selected === true;
    return {
      type: 'Pressable',
      onClickAction: { type: pressType, payload: { value: chip.value } },
      children: [
        {
          type: 'Row',
          height: 26,
          radius: 'full',
          padding: { x: 9, y: 2 },
          align: 'center',
          background: selected ? params.selectedBackground : params.restBackground,
          children: [
            {
              type: 'Text',
              value: chip.label,
              size: 'md',
              color: selected ? params.selectedLabelColor : params.restLabelColor,
              truncate: true,
            },
          ],
        },
      ],
    };
  });
  return {
    type: 'ScrollRow',
    gap: 8,
    padding: { x: 16, top: 14, bottom: 7 },
    children,
  };
}
