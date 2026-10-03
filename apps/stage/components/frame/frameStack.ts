import { useCallback, useEffect, useRef } from 'react';
import type { FrameNav } from '@stage-labs/kit/frame';
import type { FrameNavigation } from '@stage-labs/kit/react-native/frame';
import { makeListeners, useStoreValue } from '../../lib/storeCore';
import { frameStackOf, withFrameNav, type FrameStacks } from './frame.model';

let stacks: FrameStacks = new Map();
const listeners = makeListeners();

export function useFrameStack(id: string, start: string): FrameNavigation {
  const read = useCallback(() => stacks.get(id), [id]);
  const stack = frameStackOf(useStoreValue(listeners.subscribe, read), start);
  const navigate = useCallback((nav: FrameNav): void => {
    const next = withFrameNav(stacks, id, start, nav);
    if (next === stacks) return;
    stacks = next;
    listeners.notify();
  }, [id, start]);
  return { screen: stack[stack.length - 1] ?? start, depth: stack.length - 1, navigate };
}

export function useTopOnScreenChange(screen: string, toTop: () => void): void {
  const shown = useRef(screen);
  useEffect(() => {
    if (shown.current === screen) return;
    shown.current = screen;
    toTop();
  }, [screen]);
}
