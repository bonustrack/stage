import { isCategoryKey } from '../../lib/channelGroups.model';
import { NO_GROUP_KEY, isGroupHeader, listKeyOf, type ChannelGroupHeader, type HomeListItem } from './groups.model';

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

interface RowMeasurement {
  item: HomeListItem;
  height: number;
}

export interface RowMeasurements {
  width: number;
  rows: ReadonlyMap<string, RowMeasurement>;
}

export const NO_ROW_MEASUREMENTS: RowMeasurements = { width: 0, rows: new Map() };
const NO_ROW_HEIGHTS: ReadonlyMap<string, number> = new Map();

export function recordRowMeasurement(
  measured: RowMeasurements, item: HomeListItem, width: number, height: number,
): RowMeasurements {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return measured;
  const key = listKeyOf(item);
  const previous = measured.rows.get(key);
  const sameWidth = measured.width === width;
  if (sameWidth && previous?.item === item && previous.height === height) return measured;
  const rows = new Map(sameWidth ? measured.rows : undefined);
  rows.set(key, { item, height });
  return { width, rows };
}

export function measuredRowHeights(items: readonly HomeListItem[], measured: RowMeasurements): ReadonlyMap<string, number> {
  const heights = new Map<string, number>();
  for (const item of items) {
    const key = listKeyOf(item);
    const size = measured.rows.get(key);
    if (size?.item === item) heights.set(key, size.height);
  }
  return heights;
}

function topsOf(heights: readonly number[]): number[] {
  const tops: number[] = [];
  let top = 0;
  for (const height of heights) { tops.push(top); top += height; }
  return tops;
}

export function domElementOf(node: unknown, web: boolean): HTMLElement | null {
  return web && typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}

export function rowBlocks(ids: readonly string[], rowHeight: number, measured: ReadonlyMap<string, number> = NO_ROW_HEIGHTS): DragBlocks {
  const heights = ids.map(id => measured.get(id) ?? rowHeight);
  return { ids, tops: topsOf(heights), heights, blockOf: new Map(ids.map((id, i) => [id, i])), zones: [] };
}

export function sectionShape(items: readonly HomeListItem[]): string {
  return items.map(item => (isGroupHeader(item) ? `#${item.header.key}` : item.convId)).join('\n');
}

export function sectionBlocks(
  items: readonly HomeListItem[], headerHeight: number, rowHeight: number, measured: ReadonlyMap<string, number> = NO_ROW_HEIGHTS,
): DragBlocks {
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
      heights[current] = (heights[current] ?? 0) + (measured.get(listKeyOf(item)) ?? rowHeight);
    }
    if (current !== -1) blockOf.set(item.convId, current);
  }
  return { ids, tops: topsOf(heights), heights, blockOf, zones: [] };
}

function categoryOfHeader(header: ChannelGroupHeader): string | null | undefined {
  if (isCategoryKey(header.key)) return header.title;
  return header.key === NO_GROUP_KEY ? null : undefined;
}

export function categoryZones(
  items: readonly HomeListItem[], headerHeight: number, rowHeight: number, measured: ReadonlyMap<string, number> = NO_ROW_HEIGHTS,
): CategoryZones {
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
    heights.push(isGroupHeader(item) ? headerHeight : measured.get(listKeyOf(item)) ?? rowHeight);
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
