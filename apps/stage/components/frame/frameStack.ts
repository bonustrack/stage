import { useCallback, useEffect, useMemo, useRef } from 'react';
import { frameStartSurface, type FrameContent } from '@stage-labs/client/xmtp/frame';
import { frameStackOf, type FrameNav } from '../../lib/frames/frameStacks';
import { frameStacks } from '../../lib/frames/runtime';
import { useStoreValue } from '../../lib/storeCore';
import type { FrameNavigation } from './FrameView';

export function useFrameStack(stackKey: string, frame: FrameContent | null): FrameNavigation {
  const start = useMemo(() => (frame === null ? '' : (frameStartSurface(frame) ?? '')), [frame]);
  const read = useCallback(() => frameStacks.stackOf(stackKey), [stackKey]);
  const stack = frameStackOf(useStoreValue(frameStacks.subscribe, read), start);
  const navigate = useCallback(
    (nav: FrameNav): void => {
      frameStacks.navigate(stackKey, start, nav);
    },
    [stackKey, start],
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
