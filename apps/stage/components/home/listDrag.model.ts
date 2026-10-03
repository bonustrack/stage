import { isCategoryKey } from '../../lib/channelGroups.model';
import { NO_GROUP_KEY, isGroupHeader, type ChannelGroupHeader, type HomeListItem } from './groups.model';

export interface DragBlocks {
  ids: readonly string[];
  tops: readonly number[];
  heights: readonly number[];
  blockOf: ReadonlyMap<string, number>;
  zones: readonly number[];
}

export interface CategoryZones {
  blocks: DragBlocks;
  categories: ReadonlyMap<string, string | null>;
}

export const NO_BLOCKS: DragBlocks = { ids: [], tops: [], heights: [], blockOf: new Map(), zones: [] };

export const NO_ZONES: CategoryZones = { blocks: NO_BLOCKS, categories: new Map() };

function topsOf(heights: readonly number[]): number[] {
  const tops: number[] = [];
  let top = 0;
  for (const height of heights) { tops.push(top); top += height; }
  return tops;
}

export function uniformBlocks(ids: readonly string[], height: number): DragBlocks {
  const heights = ids.map(() => height);
  return { ids, tops: topsOf(heights), heights, blockOf: new Map(ids.map((id, i) => [id, i])), zones: [] };
}

export function sectionShape(items: readonly HomeListItem[]): string {
  return items.map(item => (isGroupHeader(item) ? `#${item.header.key}` : item.convId)).join('\n');
}

export function sectionBlocks(items: readonly HomeListItem[], headerHeight: number, rowHeight: number): DragBlocks {
  const ids: string[] = [];
  const heights: number[] = [];
  const blockOf = new Map<string, number>();
  let current = -1;
  for (const item of items) {
    if (isGroupHeader(item)) {
      current = isCategoryKey(item.header.key) ? ids.length : -1;
      if (current === -1) continue;
      ids.push(item.header.key);
      heights.push(headerHeight);
    } else if (current !== -1) {
      heights[current] = (heights[current] ?? 0) + rowHeight;
    }
    if (current !== -1) blockOf.set(item.convId, current);
  }
  return { ids, tops: topsOf(heights), heights, blockOf, zones: [] };
}

function categoryOfHeader(header: ChannelGroupHeader): string | null | undefined {
  if (isCategoryKey(header.key)) return header.title;
  return header.key === NO_GROUP_KEY ? null : undefined;
}

export function categoryZones(items: readonly HomeListItem[], headerHeight: number, rowHeight: number): CategoryZones {
  const ids: string[] = [];
  const heights: number[] = [];
  const zones: number[] = [];
  const blockOf = new Map<string, number>();
  const categories = new Map<string, string | null>();
  let zone = -1;
  for (const item of items) {
    const index = ids.length;
    if (isGroupHeader(item)) {
      const category = categoryOfHeader(item.header);
      zone = category === undefined ? -1 : index;
      if (category !== undefined) categories.set(item.header.key, category);
    }
    ids.push(isGroupHeader(item) ? item.header.key : item.convId);
    heights.push(isGroupHeader(item) ? headerHeight : rowHeight);
    zones.push(zone);
    if (zone !== -1) blockOf.set(item.convId, index);
  }
  return { blocks: { ids, tops: topsOf(heights), heights, blockOf, zones }, categories };
}

function centerOf(tops: readonly number[], heights: readonly number[], index: number): number {
  'worklet';
  return (tops[index] ?? 0) + (heights[index] ?? 0) / 2;
}

export function dropTarget(tops: readonly number[], heights: readonly number[], from: number, offset: number): number {
  'worklet';
  const top = (tops[from] ?? 0) + offset;
  const bottom = top + (heights[from] ?? 0);
  let to = from;
  for (let j = from + 1; j < tops.length; j++) {
    if (centerOf(tops, heights, j) < bottom) to = j;
  }
  for (let j = from - 1; j >= 0; j--) {
    if (centerOf(tops, heights, j) > top) to = j;
  }
  return to;
}

export function zoneTarget(
  tops: readonly number[], heights: readonly number[], zones: readonly number[], from: number, offset: number,
): number {
  'worklet';
  const center = (tops[from] ?? 0) + (heights[from] ?? 0) / 2 + offset;
  let at = 0;
  for (let j = 1; j < tops.length; j++) {
    if ((tops[j] ?? 0) <= center) at = j;
  }
  const zone = zones[at] ?? -1;
  return zone === -1 || zone === zones[from] ? from : zone;
}

export function dragTarget(
  tops: readonly number[], heights: readonly number[], zones: readonly number[], from: number, offset: number,
): number {
  'worklet';
  return zones.length === 0 ? dropTarget(tops, heights, from, offset) : zoneTarget(tops, heights, zones, from, offset);
}

export function blockShift(index: number, from: number, to: number, movedHeight: number): number {
  'worklet';
  if (index > from && index <= to) return -movedHeight;
  if (index < from && index >= to) return movedHeight;
  return 0;
}
