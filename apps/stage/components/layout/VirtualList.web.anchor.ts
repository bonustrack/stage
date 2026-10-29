import { useCallback, useLayoutEffect, useRef, type RefObject } from 'react';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { ScrollHost } from './VirtualList.web.host';
import { LIST_CELL_SELECTOR } from './VirtualList.model';
import type { ListAnchor, VirtualListProps } from './VirtualList.types';

const ANCHOR_SETTLE_FRAMES = 8;

export type ListVirtualizer = Pick<
  Virtualizer<Window, Element> | Virtualizer<HTMLDivElement, Element>,
  'getVirtualItems' | 'getTotalSize' | 'measureElement' | 'scrollToIndex' | 'options'
>;

export interface ListRefs {
  root: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  items: RefObject<HTMLDivElement | null>;
}

function rowElements(refs: ListRefs): HTMLElement[] {
  return Array.from(refs.items.current?.querySelectorAll<HTMLElement>(LIST_CELL_SELECTOR) ?? []);
}

function viewportTop(refs: ListRefs, scroll: VirtualListProps<unknown>['scroll']): number {
  return scroll === 'self' ? (refs.root.current?.getBoundingClientRect().top ?? 0) : 0;
}

export function visibleAnchor<T>(props: VirtualListProps<T>, refs: ListRefs, virtualizer: ListVirtualizer): ListAnchor | null {
  const top = viewportTop(refs, props.scroll);
  for (const el of rowElements(refs)) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= top) continue;
    const index = Number(el.dataset.index);
    return { key: String(virtualizer.options.getItemKey(index)), offset: rect.top - top };
  }
  return null;
}

function keyIndexOf<T>(props: VirtualListProps<T>, virtualizer: ListVirtualizer, key: string): number {
  const count = props.data?.length ?? 0;
  for (let i = 0; i < count; i++) if (String(virtualizer.options.getItemKey(i)) === key) return i;
  return -1;
}

export function scrollToAnchor<T>(
  props: VirtualListProps<T>,
  refs: ListRefs,
  host: ScrollHost,
  virtualizer: ListVirtualizer,
  anchor: ListAnchor,
): boolean {
  const index = keyIndexOf(props, virtualizer, anchor.key);
  if (index === -1) return false;
  virtualizer.scrollToIndex(index, { align: 'start' });
  const settle = (framesLeft: number, stableFrames: number): void => {
    const el = rowElements(refs).find((row) => row.dataset.index === String(index));
    if (el === undefined) return;
    const delta = el.getBoundingClientRect().top - viewportTop(refs, props.scroll) - anchor.offset;
    if (Math.abs(delta) > 1) host.scrollTo(host.metrics().offset + delta, false);
    const stable = Math.abs(delta) <= 1 ? stableFrames + 1 : 0;
    if (framesLeft > 0 && stable < 2)
      requestAnimationFrame(() => {
        settle(framesLeft - 1, stable);
      });
  };
  settle(ANCHOR_SETTLE_FRAMES, 0);
  return true;
}

export function usePrependAnchor<T>(
  props: VirtualListProps<T>,
  refs: ListRefs,
  host: ScrollHost,
  virtualizer: ListVirtualizer,
): () => void {
  const lastAnchor = useRef<ListAnchor | null>(null);
  const firstKey = useRef<string | null>(null);
  const remember = useCallback(() => {
    lastAnchor.current = props.maintainVisibleContentPosition == null ? null : visibleAnchor(props, refs, virtualizer);
  }, [props, refs, virtualizer]);
  useLayoutEffect(() => {
    const previous = firstKey.current;
    firstKey.current = (props.data?.length ?? 0) > 0 ? String(virtualizer.options.getItemKey(0)) : null;
    const anchor = lastAnchor.current;
    if (previous === null || anchor === null || props.stickToEnd?.() === true || previous === firstKey.current) return;
    if (keyIndexOf(props, virtualizer, previous) > 0) scrollToAnchor(props, refs, host, virtualizer, anchor);
  }, [props.data, props, refs, host, virtualizer]);
  return remember;
}
