import { useCallback, useEffect, useMemo, useRef } from 'react';
import { frameStartSurface, type FrameContent } from '@stage-labs/client/xmtp/frame';
import { makeListeners, useStoreValue } from '../../lib/storeCore';
import { frameStackOf, withFrameNav, type FrameNav, type FrameStacks } from './frame.model';
import type { FrameNavigation } from './FrameView';

let stacks: FrameStacks = new Map();
const listeners = makeListeners();

export function useFrameStack(id: string, frame: FrameContent | null): FrameNavigation {
  const start = useMemo(() => (frame === null ? '' : (frameStartSurface(frame) ?? '')), [frame]);
  const read = useCallback(() => stacks.get(id), [id]);
  const stack = frameStackOf(useStoreValue(listeners.subscribe, read), start);
  const navigate = useCallback(
    (nav: FrameNav): void => {
      const next = withFrameNav(stacks, id, start, nav);
      if (next === stacks) return;
      stacks = next;
      listeners.notify();
    },
    [id, start],
  );
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
