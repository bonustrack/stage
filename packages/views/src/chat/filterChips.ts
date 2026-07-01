import type { Color, RowNode, WidgetNode } from '@stage-labs/kit/kit';
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
  const selectType = params.selectType ?? FILTER_SELECT;
  const children = params.chips.map((chip): WidgetNode => {
    const selected = chip.selected === true;
    return {
      type: 'Pressable',
      onClickAction: { type: selectType, payload: { value: chip.value } },
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
  return { type: 'Row', gap: 8, align: 'center', wrap: 'wrap', children };
}
