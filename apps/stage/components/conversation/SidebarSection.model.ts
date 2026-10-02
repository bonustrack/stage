import type { MenuPoint } from '../AnchoredMenu.model';
import { uniqueBy } from '@stage-labs/client/collections';

export interface ListEdits { added: string[]; removed: string[] }

export interface PickerAnchor { point: MenuPoint; width: number }

interface Rect { left: number; right: number; bottom: number; width: number }

export const PICKER_MAX_WIDTH = 400;

const keyOf = (value: string): string => value.toLowerCase();

export function includesKey(list: readonly string[], value: string): boolean {
  const key = keyOf(value);
  return list.some((item) => keyOf(item) === key);
}

export function uniqueKeys(list: readonly string[]): string[] {
  return uniqueBy(list, keyOf);
}

export function toggleKey(list: readonly string[], value: string): string[] {
  const key = keyOf(value);
  return includesKey(list, value) ? list.filter((item) => keyOf(item) !== key) : [...list, value];
}

function missingFrom(list: readonly string[], other: readonly string[]): string[] {
  return list.filter((item) => !includesKey(other, item));
}

export function listEdits(current: readonly string[], next: readonly string[]): ListEdits {
  return { added: missingFrom(next, current), removed: missingFrom(current, next) };
}

export function hasListEdits(edits: ListEdits): boolean {
  return edits.added.length > 0 || edits.removed.length > 0;
}

export function applyListEdits(list: readonly string[], edits: ListEdits): string[] {
  return uniqueKeys([...missingFrom(list, edits.removed), ...edits.added]);
}

export function matchesQuery(query: string, ...texts: string[]): boolean {
  const q = query.trim().toLowerCase();
  return q === '' || texts.some((text) => text.toLowerCase().includes(q));
}

export function selectedFirst(list: readonly string[], selected: readonly string[]): string[] {
  return uniqueKeys([...list.filter((item) => includesKey(selected, item)), ...list]);
}

export function pickerAnchorOf(rect: Rect | undefined, viewportWidth: number, gutter: number): PickerAnchor | null {
  if (rect === undefined) return null;
  const width = Math.min(Math.max(rect.width - gutter * 2, 0), PICKER_MAX_WIDTH);
  const onRight = (rect.left + rect.right) / 2 > viewportWidth / 2;
  return { point: { x: onRight ? rect.right - gutter : rect.left + gutter, y: rect.bottom }, width };
}
