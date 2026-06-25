import type { Color, RowNode, TextSize, WidgetNode } from '@stage-labs/kit/kit';
import { compact } from '../node';

const HL_BG = '#FFF200';

export interface HighlightTextParams {
  text: string;
  query: string;
  color?: Color;
  matchBackground?: Color;
  size?: TextSize;
  fontSize?: number;
  lineHeight?: number;
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
  const children = highlightSegments(params.text, params.query).map(
    (segment): WidgetNode =>
      compact({
        type: 'Text' as const,
        value: segment.value,
        size: params.size,
        color: params.color,
        background: segment.match ? params.matchBackground ?? HL_BG : undefined,
        fontSize: params.fontSize,
        lineHeight: params.lineHeight,
      }),
  );
  return { type: 'Row', wrap: 'wrap', align: 'baseline', children };
}
