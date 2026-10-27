import { moveAnchor, type SortMove } from '@stage-labs/kit/sortable';
import { isCategoryKey, isCategorySectionKey } from '../../lib/channelGroups.model';
import { NO_GROUP_KEY, isGroupHeader, type ChannelGroupHeader, type HomeListItem } from './groups.model';

export interface HomeDragModel {
  sections: readonly string[];
  sectionKeys: ReadonlyMap<string, string>;
  sectionOf: ReadonlyMap<string, string>;
  rows: readonly string[];
  zoneOf: ReadonlyMap<string, string>;
  categories: ReadonlyMap<string, string | null>;
}

export const NO_HOME_DRAG: HomeDragModel = {
  sections: [], sectionKeys: new Map(), sectionOf: new Map(), rows: [], zoneOf: new Map(), categories: new Map(),
};

function categoryOfHeader(header: ChannelGroupHeader): string | null | undefined {
  if (isCategoryKey(header.key)) return header.title;
  return header.key === NO_GROUP_KEY ? null : undefined;
}

export function homeDragModel(items: readonly HomeListItem[], byCategory: boolean): HomeDragModel {
  if (!byCategory) return NO_HOME_DRAG;
  const sections: string[] = [];
  const sectionKeys = new Map<string, string>();
  const sectionOf = new Map<string, string>();
  const zoneOf = new Map<string, string>();
  const categories = new Map<string, string | null>();
  let section: string | undefined;
  let zone: string | undefined;
  for (const item of items) {
    const id = item.convId;
    if (isGroupHeader(item)) {
      section = isCategorySectionKey(item.header.key) ? id : undefined;
      if (section !== undefined) { sections.push(id); sectionKeys.set(id, item.header.key); }
      const category = categoryOfHeader(item.header);
      zone = category === undefined ? undefined : id;
      if (category !== undefined) categories.set(id, category);
    } else if (section !== undefined) {
      sectionOf.set(id, section);
    }
    if (zone !== undefined) zoneOf.set(id, zone);
  }
  return { sections, sectionKeys, sectionOf, rows: items.map(item => item.convId), zoneOf, categories };
}

export function sectionMove(model: HomeDragModel, move: SortMove): { key: string; target: string; visible: string[] } | null {
  const key = model.sectionKeys.get(move.itemId);
  const anchor = moveAnchor(move);
  const target = anchor === null ? undefined : model.sectionKeys.get(anchor);
  if (key === undefined || target === undefined) return null;
  return { key, target, visible: model.sections.flatMap(id => model.sectionKeys.get(id) ?? []) };
}

export function pinMove(order: readonly string[], move: SortMove): number | null {
  const anchor = moveAnchor(move);
  const index = anchor === null ? -1 : order.indexOf(anchor);
  return index === -1 ? null : index;
}

export function zoneAt(model: HomeDragModel, itemId: string, index: number): string | undefined {
  const others = model.rows.filter(id => id !== itemId);
  const anchor = others[index - 1] ?? others[index];
  const zone = anchor === undefined ? undefined : model.zoneOf.get(anchor);
  return zone === model.zoneOf.get(itemId) ? undefined : zone;
}

export function zoneMove(model: HomeDragModel, move: SortMove): { convId: string; category: string | null } | null {
  const zone = zoneAt(model, move.itemId, move.toIndex);
  const category = zone === undefined ? undefined : model.categories.get(zone);
  return category === undefined ? null : { convId: move.itemId, category };
}

export function domElementOf(node: unknown, web: boolean): HTMLElement | null {
  return web && typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}
