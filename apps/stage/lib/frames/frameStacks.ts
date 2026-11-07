import type { SurfaceNav } from '@stage-labs/kit/a2ui/client';
import { makeListeners } from '../storeCore';

const MAX_FRAME_DEPTH = 20;

export type FrameNav = SurfaceNav;

export type FrameStacks = ReadonlyMap<string, readonly string[]>;

export function frameStackOf(stack: readonly string[] | undefined, start: string): readonly string[] {
  return stack !== undefined && stack[0] === start ? stack : [start];
}

export function navigateFrame(stack: readonly string[], nav: FrameNav): readonly string[] {
  if (nav.kind === 'close') return stack.length > 1 ? stack.slice(0, -1) : stack;
  if (stack[stack.length - 1] === nav.surfaceId || stack.length >= MAX_FRAME_DEPTH) return stack;
  return [...stack, nav.surfaceId];
}

export function withFrameNav(stacks: FrameStacks, id: string, start: string, nav: FrameNav): FrameStacks {
  const current = frameStackOf(stacks.get(id), start);
  const next = navigateFrame(current, nav);
  if (next === current) return stacks;
  const out = new Map(stacks);
  if (next.length > 1) out.set(id, next);
  else out.delete(id);
  return out;
}

export interface FrameStackStore {
  stackOf: (id: string) => readonly string[] | undefined;
  navigate: (id: string, start: string, nav: FrameNav) => void;
  subscribe: (listener: () => void) => () => void;
  clear: () => void;
}

export function makeFrameStacks(): FrameStackStore {
  let stacks: FrameStacks = new Map();
  const listeners = makeListeners();
  return {
    stackOf: (id) => stacks.get(id),
    navigate: (id, start, nav) => {
      const next = withFrameNav(stacks, id, start, nav);
      if (next === stacks) return;
      stacks = next;
      listeners.notify();
    },
    subscribe: listeners.subscribe,
    clear: () => {
      if (stacks.size === 0) return;
      stacks = new Map();
      listeners.notify();
    },
  };
}
