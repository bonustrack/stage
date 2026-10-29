import type { ReactNode } from 'react';
import { Animated, Platform } from 'react-native';
import {
  insertionIndex,
  listAt,
  nearestList,
  rectContains,
  shiftOf,
  stepTarget,
  type SortDirection,
  type SortListLayout,
  type SortStep,
  type SortTarget,
} from '../sortable';
import {
  IDLE,
  accepted,
  announce,
  bareLayouts,
  commit,
  dragOf,
  entry,
  finish,
  group,
  set,
  viewOf,
  type Core,
  type Point,
  type SortDrag,
  type SortListEntry,
  type SortState,
} from './sortable.core';
import { NO_RECT, blockOf, layoutLater, layoutNow } from './sortable.measure';
import {
  autoScroll,
  ghostInViewport,
  liftFeedback,
  measureLater,
  measureNow,
  measuresSynchronously,
  nextFrame,
  raiseWithin,
  setPageDragging,
  suppressNextClick,
} from './sortable.platform';

export type { SortDrag, SortHidden, SortIndicator, SortListEntry, SortSource, SortState } from './sortable.core';
export type { SortItemEntry } from './sortable.measure';

const MOVE_SLOP = 6;
const SHIFT_MS = 120;
const NEAR_LIST = 48;
const NATIVE_DRIVER = Platform.OS !== 'web';

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
    const size = list.indicator === 'shift' ? core.block : 0;
    for (const item of blockOf(list, id)) animateTo(core, item.offset, shiftOf(i, drag.index, toIndex, size));
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

function measureBlock(core: Core, drag: SortDrag): void {
  const list = entry(core, drag.listId);
  const rect = core.layouts.find((l) => l.listId === drag.listId)?.items.find((item) => item.id === drag.itemId)?.rect;
  core.block = list === undefined || rect === undefined ? 0 : list.direction === 'vertical' ? rect.height : rect.width;
}

async function remeasure(core: Core, drag: SortDrag): Promise<void> {
  const all = await Promise.all(group(core, drag.group).map(layoutLater));
  if (core.state.drag?.itemId === drag.itemId) core.layouts = all;
}

function sameTarget(a: SortTarget | null, b: SortTarget | null): boolean {
  return a?.listId === b?.listId && a?.index === b?.index;
}

function targetLayout(core: Core, drag: SortDrag): SortListLayout | undefined {
  const { x, y } = core.pointer;
  if (drag.inPlace) return core.layouts.find((l) => l.listId === drag.listId);
  return listAt(core.layouts, x, y) ?? nearestList(core.layouts, x, y, rectContains(core.scopeRect, x, y) ? Infinity : NEAR_LIST);
}

function retarget(core: Core, drag: SortDrag): void {
  const { pointer } = core;
  const layout = targetLayout(core, drag);
  const move = layout === undefined ? null : accepted(core, drag, layout, insertionIndex(layout, drag.itemId, pointer.x, pointer.y));
  const target = move === null ? null : { listId: move.toListId, index: move.toIndex };
  if (sameTarget(target, core.state.target)) return;
  if (drag.inPlace) slideOthers(core, drag, target?.index ?? drag.index);
  set(core, viewOf(core, drag, target));
  if (!measuresSynchronously && !drag.inPlace)
    nextFrame(() => {
      void remeasure(core, drag);
    });
}

function refresh(core: Core, drag: SortDrag): void {
  if (!measuresSynchronously || (drag.inPlace && core.layouts.length > 0)) return;
  core.layouts = group(core, drag.group).map(layoutNow);
  core.scopeRect = measureNow(core.scope()) ?? NO_RECT;
}

function place(core: Core, drag: SortDrag): void {
  if (drag.inPlace) {
    followPointer(core, drag);
    return;
  }
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

async function measureNative(core: Core, drag: SortDrag, list: SortListEntry): Promise<void> {
  const [all, rect, item] = await Promise.all([
    Promise.all(group(core, drag.group).map(layoutLater)),
    measureLater(core.scope()),
    measureLater(list.items.get(drag.itemId)?.node()),
  ]);
  if (core.state.drag !== drag) return;
  core.layouts = all;
  core.scopeRect = rect ?? NO_RECT;
  measureBlock(core, drag);
  const next =
    item === null
      ? drag
      : { ...drag, size: { width: item.width, height: item.height }, grab: { x: core.pointer.x - item.x, y: core.pointer.y - item.y } };
  place(core, next);
  set(core, viewOf(core, next, core.state.target));
}

function begin(core: Core, listId: string, itemId: string, preview: ReactNode): void {
  const list = entry(core, listId);
  if (list === undefined) return;
  const at = core.pressed;
  core.pointer = at;
  core.start = at;
  core.moved = false;
  const rect = measureNow(list.items.get(itemId)?.node()) ?? NO_RECT;
  const drag = {
    ...dragOf(list, itemId, false, preview),
    size: { width: rect.width, height: rect.height },
    grab: { x: at.x - rect.x, y: at.y - rect.y },
  };
  liftFeedback();
  setPageDragging(true);
  core.layouts = [];
  refresh(core, drag);
  measureBlock(core, drag);
  if (drag.inPlace) core.restore = raiseWithin(list.items.get(itemId)?.node(), list.node());
  place(core, drag);
  set(core, { ...viewOf(core, drag, { listId, index: drag.index }), indicator: null });
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
  const count = core.layouts.find((l) => l.listId === target.listId)?.items.length ?? 0;
  const label = list?.label === undefined ? '' : ` in ${list.label}`;
  return `Position ${target.index + 1} of ${Math.max(count, target.index + 1)}${label}`;
}

function keyLift(core: Core, listId: string, itemId: string, preview: ReactNode): void {
  const list = entry(core, listId);
  if (list === undefined) return;
  const drag = dragOf(list, itemId, true, preview);
  core.layouts = measuresSynchronously ? group(core, list.group).map(layoutNow) : bareLayouts(core, list.group);
  set(core, viewOf(core, drag, { listId, index: drag.index }));
  announce('Picked up. Use the arrow keys to move, Space to drop, Escape to cancel.');
}

function keyStep(core: Core, step: SortStep): void {
  const { drag, target: current } = core.state;
  if (drag === null || current === null) return;
  const ordered = [...core.layouts].sort((a, b) => a.rect.x - b.rect.x || a.rect.y - b.rect.y);
  const next = stepTarget(ordered, drag.itemId, current, step);
  const layout = core.layouts.find((l) => l.listId === next.listId);
  const move = layout === undefined ? null : accepted(core, drag, layout, next.index);
  if (move === null) return;
  const target = { listId: move.toListId, index: move.toIndex };
  set(core, viewOf(core, drag, target));
  announce(positionLabel(core, target));
}

function keyDrop(core: Core): void {
  const { drag, target } = core.state;
  const done = drag !== null && commit(core, drag, target);
  const message = done && target !== null ? `Dropped. ${positionLabel(core, target)}` : 'Move cancelled.';
  finish(core, done);
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
    lists: new Map(),
    listeners: new Set(),
    ghost: new Animated.ValueXY(),
    state: IDLE,
    layouts: [],
    scope: () => null,
    scopeRect: NO_RECT,
    pointer: { x: 0, y: 0 },
    pressed: { x: 0, y: 0 },
    start: { x: 0, y: 0 },
    moved: false,
    stopScroll: () => undefined,
    block: 0,
    shifts: new Map(),
    restore: () => undefined,
  };
  return {
    ghost: core.ghost,
    state: (): SortState => core.state,
    subscribe: (listener: () => void): (() => void) => {
      core.listeners.add(listener);
      return () => {
        core.listeners.delete(listener);
      };
    },
    setScope: (node: () => unknown): void => {
      core.scope = node;
    },
    register: (listId: string, read: () => SortListEntry): (() => void) => {
      core.lists.set(listId, read);
      return () => {
        if (core.lists.get(listId) === read) core.lists.delete(listId);
      };
    },
    groupSize: (name: string): number => group(core, name).length,
    press: (at: Point): void => {
      core.pressed = at;
    },
    begin: (listId: string, itemId: string, preview: ReactNode): void => {
      begin(core, listId, itemId, preview);
    },
    move: (at: Point): void => {
      move(core, at);
    },
    drop: (): boolean => drop(core),
    cancel: (): void => {
      finish(core);
    },
    wasMoved: (): boolean => core.moved,
    keyLift: (listId: string, itemId: string, preview: ReactNode): void => {
      keyLift(core, listId, itemId, preview);
    },
    keyStep: (step: SortStep): void => {
      keyStep(core, step);
    },
    keyDrop: (): void => {
      keyDrop(core);
    },
    keyCancel: (): void => {
      finish(core);
      announce('Move cancelled.');
    },
    moveBy: (listId: string, itemId: string, step: SortStep): void => {
      moveBy(core, listId, itemId, step);
    },
  };
}

export type SortCoordinator = ReturnType<typeof makeSortCoordinator>;
