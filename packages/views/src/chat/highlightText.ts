import type { Color, FontWeight, RowNode, TextSize } from '@stage-labs/kit/kit';
import { row, text } from '../primitives';

export interface HighlightTextParams {
  text: string;
  query: string;
  color?: Color;
  matchColor?: Color;
  matchWeight?: FontWeight;
  size?: TextSize;
}

interface Segment {
  value: string;
  match: boolean;
}

export function highlightSegments(value: string, query: string): Segment[] {
  if (query === '') return [{ value, match: false }];
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;
  let index = lowerValue.indexOf(lowerQuery, cursor);
  while (index !== -1) {
    if (index > cursor) {
      segments.push({ value: value.slice(cursor, index), match: false });
    }
    segments.push({ value: value.slice(index, index + query.length), match: true });
    cursor = index + query.length;
    index = lowerValue.indexOf(lowerQuery, cursor);
  }
  if (cursor < value.length) {
    segments.push({ value: value.slice(cursor), match: false });
  }
  return segments;
}

export function highlightText(params: HighlightTextParams): RowNode {
  const segments = highlightSegments(params.text, params.query);
  return row(
    segments.map((segment) =>
      text(segment.value, {
        size: params.size,
        color: segment.match ? (params.matchColor ?? 'warning') : params.color,
        weight: segment.match ? (params.matchWeight ?? 'bold') : undefined,
      }),
    ),
    { wrap: 'wrap', align: 'baseline' },
  );
}
