import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_EDGE_THRESHOLD, distanceFromEnd, distanceFromStart, endOffset, itemTranslate, nearEnd, nearStart,
} from '../components/layout/VirtualList.model';

const metrics = (offset: number, contentHeight = 4000, viewportHeight = 800) => ({ offset, contentHeight, viewportHeight });

describe('edge distances', () => {
  test('measure from the list start and end, never negative', () => {
    expect(distanceFromStart(metrics(120))).toBe(120);
    expect(distanceFromStart(metrics(-30))).toBe(0);
    expect(distanceFromEnd(metrics(3200))).toBe(0);
    expect(distanceFromEnd(metrics(1000))).toBe(2200);
  });

  test('a threshold of viewports decides when an edge counts as reached', () => {
    expect(nearStart(metrics(400), 0.5)).toBe(true);
    expect(nearStart(metrics(401), 0.5)).toBe(false);
    expect(nearEnd(metrics(2800), 0.5)).toBe(true);
    expect(nearEnd(metrics(2799), 0.5)).toBe(false);
  });

  test('falls back to FlatList\'s default threshold when none is given', () => {
    expect(DEFAULT_EDGE_THRESHOLD).toBe(2);
    expect(nearStart(metrics(1600), undefined)).toBe(true);
    expect(nearStart(metrics(1601), null)).toBe(false);
  });
});

describe('positions', () => {
  test('endOffset is the offset that shows the last pixel of content', () => {
    expect(endOffset(metrics(0))).toBe(3200);
    expect(endOffset(metrics(0, 500, 800))).toBe(0);
  });

  test('rows are translated relative to the list start, not the document', () => {
    expect(itemTranslate(1240, 240)).toBe(1000);
    expect(itemTranslate(240, 240)).toBe(0);
  });
});
