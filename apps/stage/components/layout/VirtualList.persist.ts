import { useEffect, useMemo, useRef } from 'react';
import { flushScrollOffset, getScrollOffset, peekScrollOffset, saveScrollOffset } from '../../lib/scrollPos';
import { attempt, reported } from '../../lib/errorPolicy';
import type { PersistedScroll, VirtualListHandle, VirtualListProps } from './VirtualList.types';

const windowRestoredThisLoad = new Set<string>();

export function usePersistedScroll(key: string): PersistedScroll {
  const listRef = useRef<VirtualListHandle>(null);
  const saved = useRef<number | undefined>(peekScrollOffset(key));
  const restored = useRef(false);
  useEffect(() => {
    void getScrollOffset(key).then((o) => {
      saved.current ??= o;
    }, reported('list.savedScroll'));
    return () => {
      flushScrollOffset(key);
    };
  }, [key]);
  return useMemo(
    () => ({
      listRef,
      save: (offset: number) => {
        saveScrollOffset(key, offset);
      },
      restore: (contentHeight: number, documentRestoresReturns = false) => {
        if (restored.current) return;
        const markRestored = (): void => {
          restored.current = true;
          if (documentRestoresReturns) windowRestoredThisLoad.add(key);
        };
        const want = documentRestoresReturns && windowRestoredThisLoad.has(key) ? undefined : saved.current;
        if (want == null || want <= 0) {
          markRestored();
          return;
        }
        if (contentHeight <= 0) return;
        markRestored();
        const offset = Math.min(want, contentHeight);
        requestAnimationFrame(() => {
          attempt(() => {
            listRef.current?.scrollToOffset({ offset, animated: false });
          }, 'ui');
        });
      },
      resetToTop: () => {
        saved.current = 0;
        restored.current = true;
        if ((peekScrollOffset(key) ?? 0) <= 0) return;
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
      },
    }),
    [key],
  );
}

export function withPersistedScroll<T>(props: VirtualListProps<T>, documentRestoresReturns = false): VirtualListProps<T> {
  const { persist } = props;
  if (persist === undefined) return props;
  return {
    ...props,
    onScroll: (ev) => {
      persist.save(ev.nativeEvent.contentOffset.y);
      props.onScroll?.(ev);
    },
    onContentSizeChange: (w, h) => {
      persist.restore(h, documentRestoresReturns);
      props.onContentSizeChange?.(w, h);
    },
  };
}
