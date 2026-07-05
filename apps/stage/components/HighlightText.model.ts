export interface HighlightSegment {
  value: string;
  match: boolean;
}

export function highlightSegments(value: string, query: string): HighlightSegment[] {
  if (query === '') return [{ value, match: false }];
  const lowerValue = value.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: HighlightSegment[] = [];
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
