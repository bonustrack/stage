export interface ListScrollMetrics {
  offset: number;
  contentHeight: number;
  viewportHeight: number;
}

export const DEFAULT_EDGE_THRESHOLD = 2;

export function distanceFromStart(m: ListScrollMetrics): number {
  return Math.max(0, m.offset);
}

export function distanceFromEnd(m: ListScrollMetrics): number {
  return Math.max(0, m.contentHeight - m.offset - m.viewportHeight);
}

export function nearStart(m: ListScrollMetrics, threshold: number | null | undefined): boolean {
  return distanceFromStart(m) <= (threshold ?? DEFAULT_EDGE_THRESHOLD) * m.viewportHeight;
}

export function nearEnd(m: ListScrollMetrics, threshold: number | null | undefined): boolean {
  return distanceFromEnd(m) <= (threshold ?? DEFAULT_EDGE_THRESHOLD) * m.viewportHeight;
}

export function endOffset(m: ListScrollMetrics): number {
  return Math.max(0, m.contentHeight - m.viewportHeight);
}

export function itemTranslate(start: number, scrollMargin: number): number {
  return start - scrollMargin;
}
