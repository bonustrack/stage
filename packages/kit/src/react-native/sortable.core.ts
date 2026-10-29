import type { ReactNode } from 'react';
import { AccessibilityInfo, type Animated } from 'react-native';
import {
  indicatorRect,
  isNoMove,
  slotAt,
  sortMove,
  type SortListLayout,
  type SortMove,
  type SortOrigin,
  type SortRect,
  type SortSlot,
  type SortTarget,
} from '../sortable';
import { layoutOf, type MeasuredList } from './sortable.measure';
import { nextFrame, setPageDragging } from './sortable.platform';

export type SortIndicator = 'preview' | 'line' | 'none' | 'shift' | 'follow';

export interface SortSource {
  listId: string;
  payload: unknown;
}

export interface SortListEntry extends MeasuredList {
  group: string;
  label: string | undefined;
  payload: unknown;
  indicator: SortIndicator;
  placeAt: ((move: SortMove) => number) | undefined;
  accepts: (move: SortMove) => boolean;
  onMove: (move: SortMove, source: SortSource) => void;
}

export interface SortDrag extends SortOrigin {
  group: string;
  size: { width: number; height: number };
  grab: { x: number; y: number };
  preview: ReactNode;
  keyboard: boolean;
  inPlace: boolean;
}

export interface SortHidden {
  listId: string;
  itemId: string;
}

export interface SortState {
  drag: SortDrag | null;
  target: SortTarget | null;
  indicator: SortRect | null;
  slot: SortSlot | null;
  hidden: readonly SortHidden[];
  preview: ReactNode;
}

export interface Point {
  x: number;
  y: number;
}

export interface Core {
  lists: Map<string, () => SortListEntry>;
  listeners: Set<() => void>;
  ghost: Animated.ValueXY;
  state: SortState;
  layouts: SortListLayout[];
  scope: () => unknown;
  scopeRect: SortRect;
  pointer: Point;
  pressed: Point;
  start: Point;
  moved: boolean;
  stopScroll: () => void;
  block: number;
  shifts: Map<Animated.Value, number>;
  restore: () => void;
}

export const IDLE: SortState = { drag: null, target: null, indicator: null, slot: null, hidden: [], preview: null };
const INDICATOR = 2;
const NO_SIZE = { width: 0, height: 0 };

export function set(core: Core, next: SortState): void {
  core.state = next;
  for (const listener of core.listeners) listener();
}

export function entry(core: Core, listId: string): SortListEntry | undefined {
  return core.lists.get(listId)?.();
}

export function group(core: Core, name: string): SortListEntry[] {
  return [...core.lists.values()].map((read) => read()).filter((list) => list.group === name);
}

export function announce(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}

export function bareLayouts(core: Core, name: string): SortListLayout[] {
  return group(core, name).map((list) => layoutOf(list, null, []));
}

function resetOffsets(core: Core): void {
  for (const offset of core.shifts.keys()) offset.setValue(0);
  core.shifts.clear();
}

export function accepted(core: Core, drag: SortDrag, layout: SortListLayout, index: number): SortMove | null {
  const list = entry(core, layout.listId);
  if (list === undefined) return null;
  const asked = sortMove(drag, layout, index);
  const last = layout.ids.filter((id) => id !== drag.itemId).length;
  const move = list.placeAt === undefined ? asked : sortMove(drag, layout, Math.max(0, Math.min(last, list.placeAt(asked))));
  return list.accepts(move) ? move : null;
}

function lineAt(core: Core, drag: SortDrag, target: SortTarget | null): SortRect | null {
  const layout = core.layouts.find((l) => l.listId === target?.listId);
  if (target === null || layout === undefined || entry(core, target.listId)?.indicator !== 'line') return null;
  return indicatorRect(layout, drag.itemId, target.index, INDICATOR);
}

export function viewOf(core: Core, drag: SortDrag, target: SortTarget | null): SortState {
  const shown = target ?? drag;
  const into = entry(core, shown.listId);
  const ready = drag.keyboard || drag.size.width > 0 || drag.size.height > 0;
  return {
    drag,
    target,
    preview: drag.preview,
    indicator: lineAt(core, drag, target),
    slot: ready && into?.indicator === 'preview' ? slotAt(shown.listId, into.itemIds, drag.itemId, shown.index) : null,
    hidden: ready && entry(core, drag.listId)?.indicator === 'preview' ? [{ listId: drag.listId, itemId: drag.itemId }] : [],
  };
}

export function commit(core: Core, drag: SortDrag, target: SortTarget | null): boolean {
  const layout = core.layouts.find((l) => l.listId === target?.listId);
  if (target === null || layout === undefined) return false;
  const move = accepted(core, drag, layout, target.index);
  if (move === null || isNoMove(move)) return false;
  entry(core, move.toListId)?.onMove(move, { listId: drag.listId, payload: entry(core, drag.listId)?.payload });
  return true;
}

function settledView({ drag, target, slot, hidden, preview }: SortState): SortState {
  const landed = drag !== null && target !== null && slot !== null ? [{ listId: target.listId, itemId: drag.itemId }] : [];
  return { ...IDLE, slot, hidden: [...hidden, ...landed], preview };
}

export function finish(core: Core, settled = false): void {
  core.stopScroll();
  setPageDragging(false);
  core.restore();
  core.restore = () => undefined;
  core.layouts = [];
  if (!settled) {
    resetOffsets(core);
    set(core, IDLE);
    return;
  }
  const held = settledView(core.state);
  set(core, held);
  nextFrame(() => {
    resetOffsets(core);
    if (core.state === held) set(core, IDLE);
  });
}

export function dragOf(list: SortListEntry, itemId: string, keyboard: boolean, preview: ReactNode = null): SortDrag {
  return {
    itemId,
    listId: list.listId,
    index: list.itemIds.indexOf(itemId),
    group: list.group,
    preview,
    keyboard,
    inPlace: !keyboard && (list.indicator === 'shift' || list.indicator === 'follow'),
    size: NO_SIZE,
    grab: { x: 0, y: 0 },
  };
}
