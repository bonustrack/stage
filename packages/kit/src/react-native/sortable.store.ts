import type { ReactNode } from 'react';
import { AccessibilityInfo, Animated, Platform } from 'react-native';
import {
  indicatorRect, insertionIndex, isNoMove, listAt, shiftOf, sortMove, stepTarget,
  type SortDirection, type SortListLayout, type SortMove, type SortOrigin, type SortRect, type SortStep, type SortTarget,
} from '../sortable';
import {
  autoScroll, ghostInViewport, liftFeedback, measureLater, measureNow, measuresSynchronously, nextFrame, raiseWithin, setPageDragging, suppressNextClick,
} from './sortable.platform';

export type SortIndicator = 'line' | 'none' | 'shift';

export interface SortItemEntry { node: () => unknown; offset: Animated.Value; follows: string | undefined }

export interface SortSource { listId: string; payload: unknown }

export interface SortListEntry {
  listId: string;
  group: string;
  direction: SortDirection;
  label: string | undefined;
  itemIds: readonly string[];
  payload: unknown;
  indicator: SortIndicator;
  node: () => unknown;
  items: ReadonlyMap<string, SortItemEntry>;
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

export interface SortState { drag: SortDrag | null; target: SortTarget | null; indicator: SortRect | null }

interface Point { x: number; y: number }

interface Core {
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

const IDLE: SortState = { drag: null, target: null, indicator: null };
const INDICATOR = 2;
const NO_RECT: SortRect = { x: 0, y: 0, width: 0, height: 0 };
const NO_SIZE = { width: 0, height: 0 };
const MOVE_SLOP = 6;
const SHIFT_MS = 120;
const NATIVE_DRIVER = Platform.OS !== 'web';

function set(core: Core, next: SortState): void {
  core.state = next;
  for (const listener of core.listeners) listener();
}

function entry(core: Core, listId: string): SortListEntry | undefined {
  return core.lists.get(listId)?.();
}

function group(core: Core, name: string): SortListEntry[] {
  return [...core.lists.values()].map(read => read()).filter(list => list.group === name);
}

function announce(text: string): void {
  AccessibilityInfo.announceForAccessibility(text);
}

function blockOf(list: SortListEntry, id: string): SortItemEntry[] {
  const lead = list.items.get(id);
  const followers = [...list.items.values()].filter(item => item.follows === id);
  return lead === undefined ? followers : [lead, ...followers];
}

function union(rects: readonly (SortRect | null)[]): SortRect | null {
  const known = rects.filter((rect): rect is SortRect => rect !== null);
  if (known.length === 0) return null;
  const x = Math.min(...known.map(r => r.x));
  const y = Math.min(...known.map(r => r.y));
  return { x, y, width: Math.max(...known.map(r => r.x + r.width)) - x, height: Math.max(...known.map(r => r.y + r.height)) - y };
}

function layoutOf(list: SortListEntry, rect: SortRect | null, rects: readonly (SortRect | null)[]): SortListLayout {
  return {
    listId: list.listId, direction: list.direction, rect: rect ?? NO_RECT, ids: list.itemIds,
    items: list.itemIds.flatMap((id, i) => { const r = rects[i]; return r === null || r === undefined ? [] : [{ id, rect: r }]; }),
  };
}

function layoutNow(list: SortListEntry): SortListLayout {
  return layoutOf(list, measureNow(list.node()), list.itemIds.map(id => union(blockOf(list, id).map(item => measureNow(item.node())))));
}

async function layoutLater(list: SortListEntry): Promise<SortListLayout> {
  const rects = await Promise.all(list.itemIds.map(async id => union(await Promise.all(blockOf(list, id).map(item => measureLater(item.node()))))));
  return layoutOf(list, await measureLater(list.node()), rects);
}

function bareLayouts(core: Core, name: string): SortListLayout[] {
  return group(core, name).map(list => layoutOf(list, null, []));
}

function axisOf(direction: SortDirection, point: Point): number {
  return direction === 'vertical' ? point.y : point.x;
}

function animateTo(core: Core, offset: Animated.Value, value: number): void {
  if (core.shifts.get(offset) === value) return;
  core.shifts.set(offset, value);
  Animated.timing(offset, { toValue: value, duration: SHIFT_MS, useNativeDriver: NATIVE_DRIVER }).start();
}

function slideOthers(core: Core, drag: SortDrag, toIndex: number): void {
  const list = entry(core, drag.listId);
  if (list === undefined) return;
  list.itemIds.forEach((id, i) => {
    if (id === drag.itemId) return;
    for (const item of blockOf(list, id)) animateTo(core, item.offset, shiftOf(i, drag.index, toIndex, core.block));
  });
}

function followPointer(core: Core, drag: SortDrag): void {
  const list = entry(core, drag.listId);
  if (list === undefined) return;
  const delta = axisOf(list.direction, core.pointer) - axisOf(list.direction, core.start);
  for (const item of blockOf(list, drag.itemId)) {
    core.shifts.set(item.offset, delta);
    item.offset.setValue(delta);
  }
}

function resetOffsets(core: Core): void {
  for (const offset of core.shifts.keys()) offset.setValue(0);
  core.shifts.clear();
}

function measureBlock(core: Core, drag: SortDrag): void {
  const list = entry(core, drag.listId);
  const rect = core.layouts.find(l => l.listId === drag.listId)?.items.find(item => item.id === drag.itemId)?.rect;
  core.block = list === undefined || rect === undefined ? 0 : (list.direction === 'vertical' ? rect.height : rect.width);
}

function accepted(core: Core, drag: SortDrag, layout: SortListLayout, index: number): SortMove | null {
  const move = sortMove(drag, layout, index);
  return entry(core, layout.listId)?.accepts(move) === true ? move : null;
}

function sameTarget(a: SortTarget | null, b: SortTarget | null): boolean {
  return a?.listId === b?.listId && a?.index === b?.index;
}

function targetLayout(core: Core, drag: SortDrag): SortListLayout | undefined {
  return drag.inPlace ? core.layouts.find(l => l.listId === drag.listId) : listAt(core.layouts, core.pointer.x, core.pointer.y);
}

function retarget(core: Core, drag: SortDrag): void {
  const { pointer, state } = core;
  const layout = targetLayout(core, drag);
  const index = layout === undefined ? -1 : insertionIndex(layout, drag.itemId, pointer.x, pointer.y);
  const ok = layout !== undefined && accepted(core, drag, layout, index) !== null;
  const target = ok ? { listId: layout.listId, index } : null;
  if (sameTarget(target, state.target)) return;
  if (drag.inPlace) slideOthers(core, drag, target?.index ?? drag.index);
  set(core, { drag, target, indicator: ok && !drag.inPlace ? indicatorRect(layout, drag.itemId, index, INDICATOR) : null });
}

function refresh(core: Core, drag: SortDrag): void {
  if (!measuresSynchronously || (drag.inPlace && core.layouts.length > 0)) return;
  core.layouts = group(core, drag.group).map(layoutNow);
  core.scopeRect = measureNow(core.scope()) ?? NO_RECT;
}

function place(core: Core, drag: SortDrag): void {
  if (drag.inPlace) { followPointer(core, drag); return; }
  const origin = ghostInViewport ? { x: 0, y: 0 } : core.scopeRect;
  core.ghost.setValue({ x: core.pointer.x - drag.grab.x - origin.x, y: core.pointer.y - drag.grab.y - origin.y });
}

function scrollLoop(core: Core): void {
  core.stopScroll();
  core.stopScroll = nextFrame(() => {
    const drag = core.state.drag;
    if (drag === null || drag.inPlace || !autoScroll(core.pointer.x, core.pointer.y)) return;
    refresh(core, drag);
    place(core, drag);
    retarget(core, drag);
    scrollLoop(core);
  });
}

function commit(core: Core, drag: SortDrag, target: SortTarget | null): boolean {
  const layout = core.layouts.find(l => l.listId === target?.listId);
  if (target === null || layout === undefined) return false;
  const move = accepted(core, drag, layout, target.index);
  if (move === null || isNoMove(move)) return false;
  entry(core, move.toListId)?.onMove(move, { listId: drag.listId, payload: entry(core, drag.listId)?.payload });
  return true;
}

function finish(core: Core, settled = false): void {
  core.stopScroll();
  setPageDragging(false);
  core.restore();
  core.restore = () => undefined;
  core.layouts = [];
  if (settled) nextFrame(() => { resetOffsets(core); });
  else resetOffsets(core);
  set(core, IDLE);
}

function dragOf(list: SortListEntry, itemId: string, keyboard: boolean, preview: ReactNode = null): SortDrag {
  return {
    itemId, listId: list.listId, index: list.itemIds.indexOf(itemId), group: list.group, preview, keyboard,
    inPlace: !keyboard && list.indicator === 'shift', size: NO_SIZE, grab: { x: 0, y: 0 },
  };
}

async function measureNative(core: Core, drag: SortDrag, list: SortListEntry): Promise<void> {
  const [all, rect, item] = await Promise.all([
    Promise.all(group(core, drag.group).map(layoutLater)), measureLater(core.scope()), measureLater(list.items.get(drag.itemId)?.node()),
  ]);
  if (core.state.drag !== drag) return;
  core.layouts = all;
  core.scopeRect = rect ?? NO_RECT;
  measureBlock(core, drag);
  const next = item === null ? drag : { ...drag, size: { width: item.width, height: item.height }, grab: { x: core.pointer.x - item.x, y: core.pointer.y - item.y } };
  place(core, next);
  set(core, { ...core.state, drag: next });
}

function begin(core: Core, listId: string, itemId: string, preview: ReactNode): void {
  const list = entry(core, listId);
  if (list === undefined) return;
  const at = core.pressed;
  core.pointer = at;
  core.start = at;
  core.moved = false;
  const rect = measureNow(list.items.get(itemId)?.node()) ?? NO_RECT;
  const drag = { ...dragOf(list, itemId, false, preview), size: { width: rect.width, height: rect.height }, grab: { x: at.x - rect.x, y: at.y - rect.y } };
  liftFeedback();
  setPageDragging(true);
  core.layouts = [];
  refresh(core, drag);
  measureBlock(core, drag);
  if (drag.inPlace) core.restore = raiseWithin(list.items.get(itemId)?.node(), list.node());
  place(core, drag);
  set(core, { drag, target: { listId, index: drag.index }, indicator: null });
  if (!measuresSynchronously) void measureNative(core, drag, list);
}

function move(core: Core, at: Point): void {
  const drag = core.state.drag;
  if (drag === null || drag.keyboard) return;
  core.pointer = at;
  core.moved = core.moved || Math.hypot(at.x - core.start.x, at.y - core.start.y) >= MOVE_SLOP;
  refresh(core, drag);
  place(core, drag);
  retarget(core, drag);
  scrollLoop(core);
}

function drop(core: Core): boolean {
  const drag = core.state.drag;
  const done = drag !== null && core.moved && commit(core, drag, core.state.target);
  if (core.moved) suppressNextClick();
  finish(core, done);
  return done;
}

function positionLabel(core: Core, target: SortTarget): string {
  const list = entry(core, target.listId);
  const count = core.layouts.find(l => l.listId === target.listId)?.items.length ?? 0;
  const label = list?.label === undefined ? '' : ` in ${list.label}`;
  return `Position ${target.index + 1} of ${Math.max(count, target.index + 1)}${label}`;
}

function keyLift(core: Core, listId: string, itemId: string): void {
  const list = entry(core, listId);
  if (list === undefined) return;
  const drag = dragOf(list, itemId, true);
  core.layouts = measuresSynchronously ? group(core, list.group).map(layoutNow) : bareLayouts(core, list.group);
  const layout = core.layouts.find(l => l.listId === listId);
  set(core, { drag, target: { listId, index: drag.index }, indicator: layout === undefined ? null : indicatorRect(layout, itemId, drag.index, INDICATOR) });
  announce('Picked up. Use the arrow keys to move, Space to drop, Escape to cancel.');
}

function keyStep(core: Core, step: SortStep): void {
  const { drag, target: current } = core.state;
  if (drag === null || current === null) return;
  const ordered = [...core.layouts].sort((a, b) => (a.rect.x - b.rect.x) || (a.rect.y - b.rect.y));
  const target = stepTarget(ordered, drag.itemId, current, step);
  const layout = core.layouts.find(l => l.listId === target.listId);
  if (layout === undefined || accepted(core, drag, layout, target.index) === null) return;
  set(core, { drag, target, indicator: indicatorRect(layout, drag.itemId, target.index, INDICATOR) });
  announce(positionLabel(core, target));
}

function keyDrop(core: Core): void {
  const { drag, target } = core.state;
  const done = drag !== null && commit(core, drag, target);
  const message = done && target !== null ? `Dropped. ${positionLabel(core, target)}` : 'Move cancelled.';
  finish(core);
  announce(message);
}

function moveBy(core: Core, listId: string, itemId: string, step: SortStep): void {
  const list = entry(core, listId);
  if (list === undefined) return;
  core.layouts = bareLayouts(core, list.group);
  const drag = dragOf(list, itemId, true);
  commit(core, drag, stepTarget(core.layouts, itemId, { listId, index: drag.index }, step));
  core.layouts = [];
}

export function makeSortCoordinator() {
  const core: Core = {
    lists: new Map(), listeners: new Set(), ghost: new Animated.ValueXY(), state: IDLE, layouts: [],
    scope: () => null, scopeRect: NO_RECT, pointer: { x: 0, y: 0 }, pressed: { x: 0, y: 0 }, start: { x: 0, y: 0 }, moved: false,
    stopScroll: () => undefined, block: 0, shifts: new Map(), restore: () => undefined,
  };
  return {
    ghost: core.ghost,
    state: (): SortState => core.state,
    subscribe: (listener: () => void): (() => void) => { core.listeners.add(listener); return () => { core.listeners.delete(listener); }; },
    setScope: (node: () => unknown): void => { core.scope = node; },
    register: (listId: string, read: () => SortListEntry): (() => void) => {
      core.lists.set(listId, read);
      return () => { if (core.lists.get(listId) === read) core.lists.delete(listId); };
    },
    groupSize: (name: string): number => group(core, name).length,
    press: (at: Point): void => { core.pressed = at; },
    begin: (listId: string, itemId: string, preview: ReactNode): void => { begin(core, listId, itemId, preview); },
    move: (at: Point): void => { move(core, at); },
    drop: (): boolean => drop(core),
    cancel: (): void => { finish(core); },
    wasMoved: (): boolean => core.moved,
    keyLift: (listId: string, itemId: string): void => { keyLift(core, listId, itemId); },
    keyStep: (step: SortStep): void => { keyStep(core, step); },
    keyDrop: (): void => { keyDrop(core); },
    keyCancel: (): void => { finish(core); announce('Move cancelled.'); },
    moveBy: (listId: string, itemId: string, step: SortStep): void => { moveBy(core, listId, itemId, step); },
  };
}

export type SortCoordinator = ReturnType<typeof makeSortCoordinator>;
