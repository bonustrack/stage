import type { Animated } from 'react-native';
import { unionRect, type SortDirection, type SortListLayout, type SortRect } from '../sortable';
import { measureLater, measureNow } from './sortable.platform';

export interface SortItemEntry {
  node: () => unknown;
  offset: Animated.Value;
  follows: string | undefined;
}

export interface MeasuredList {
  listId: string;
  direction: SortDirection;
  itemIds: readonly string[];
  node: () => unknown;
  items: ReadonlyMap<string, SortItemEntry>;
}

export const NO_RECT: SortRect = { x: 0, y: 0, width: 0, height: 0 };

export function blockOf(list: MeasuredList, id: string): SortItemEntry[] {
  const lead = list.items.get(id);
  const followers = [...list.items.values()].filter((item) => item.follows === id);
  return lead === undefined ? followers : [lead, ...followers];
}

export function layoutOf(list: MeasuredList, rect: SortRect | null, rects: readonly (SortRect | null)[]): SortListLayout {
  return {
    listId: list.listId,
    direction: list.direction,
    rect: rect ?? NO_RECT,
    ids: list.itemIds,
    items: list.itemIds.flatMap((id, i) => {
      const r = rects[i];
      return r === null || r === undefined ? [] : [{ id, rect: r }];
    }),
  };
}

export function layoutNow(list: MeasuredList): SortListLayout {
  return layoutOf(
    list,
    measureNow(list.node()),
    list.itemIds.map((id) => unionRect(blockOf(list, id).map((item) => measureNow(item.node())))),
  );
}

export async function layoutLater(list: MeasuredList): Promise<SortListLayout> {
  const rects = await Promise.all(
    list.itemIds.map(async (id) => unionRect(await Promise.all(blockOf(list, id).map((item) => measureLater(item.node()))))),
  );
  return layoutOf(list, await measureLater(list.node()), rects);
}
