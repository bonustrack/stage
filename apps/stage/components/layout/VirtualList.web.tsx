import {
  forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState,
  type ForwardedRef, type Ref, type RefObject,
} from 'react';
import { View, type NativeScrollEvent, type NativeSyntheticEvent, type ViewStyle } from 'react-native';
import { useVirtualizer, useWindowVirtualizer, type Virtualizer } from '@tanstack/react-virtual';
import { elementHost, windowHost, type ScrollHost } from './VirtualList.web.host';
import {
  distanceFromEnd, distanceFromStart, endOffset, itemTranslate, nearEnd, nearStart, type ListScrollMetrics,
} from './VirtualList.model';
import type { ListAnchor, VirtualListHandle, VirtualListProps } from './VirtualList.types';

const ESTIMATED_ITEM_SIZE = 72;
const OVERSCAN = 6;
const SEPARATORS = { highlight: () => undefined, unhighlight: () => undefined, updateProps: () => undefined };
const SELF_SCROLL = { overflowY: 'auto' } as unknown as ViewStyle;
const ITEM_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%' } as const;
const ANCHOR_SETTLE_FRAMES = 8;

type ListVirtualizer = Pick<
  Virtualizer<Window, Element> | Virtualizer<HTMLDivElement, Element>,
  'getVirtualItems' | 'getTotalSize' | 'measureElement' | 'scrollToIndex' | 'options'
>;

interface ListRefs {
  root: RefObject<HTMLDivElement | null>;
  content: RefObject<HTMLDivElement | null>;
  items: RefObject<HTMLDivElement | null>;
}

interface BodyProps<T> {
  props: VirtualListProps<T>;
  handle: ForwardedRef<VirtualListHandle>;
  refs: ListRefs;
  host: ScrollHost;
  virtualizer: ListVirtualizer;
  setScrollMargin: (margin: number) => void;
}

const asViewRef = (ref: RefObject<HTMLDivElement | null>): Ref<View> => ref as unknown as Ref<View>;

function toScrollEvent(m: ListScrollMetrics): NativeSyntheticEvent<NativeScrollEvent> {
  return {
    nativeEvent: {
      contentOffset: { x: 0, y: m.offset },
      contentSize: { width: 0, height: m.contentHeight },
      layoutMeasurement: { width: 0, height: m.viewportHeight },
      contentInset: { top: 0, left: 0, bottom: 0, right: 0 },
      zoomScale: 1,
    },
  } as unknown as NativeSyntheticEvent<NativeScrollEvent>;
}

function renderSlot(slot: React.ComponentType<unknown> | React.ReactElement | null | undefined): React.ReactNode {
  if (slot === null || slot === undefined) return null;
  if (typeof slot === 'function') { const Slot = slot; return <Slot />; }
  return slot;
}

function useListRefs(): ListRefs {
  const root = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const items = useRef<HTMLDivElement>(null);
  return useMemo(() => ({ root, content, items }), []);
}

function orderedData<T>(props: VirtualListProps<T>): readonly T[] {
  const data: readonly T[] = Array.from(props.data ?? []);
  return props.inverted === true ? [...data].reverse() : data;
}

function sourceIndex<T>(props: VirtualListProps<T>, index: number, count: number): number {
  return props.inverted === true ? count - 1 - index : index;
}

function virtualizerOptions<T>(props: VirtualListProps<T>, scrollMargin: number, viewport: number) {
  const data = orderedData(props);
  const count = data.length;
  const estimate = props.estimatedItemSize ?? ESTIMATED_ITEM_SIZE;
  const keyOf = props.keyExtractor;
  return {
    count,
    estimateSize: () => estimate,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (index: number) => {
      const item = data[index];
      return keyOf !== undefined && item !== undefined ? keyOf(item, sourceIndex(props, index, count)) : index;
    },
    initialOffset: props.anchor === 'end' ? Math.max(0, count * estimate - viewport) : 0,
  };
}

function useEdgeCallbacks<T>(props: VirtualListProps<T>, host: ScrollHost, count: number): () => void {
  const fired = useRef({ start: -1, end: -1 });
  const latest = useRef(props);
  latest.current = props;
  return useCallback(() => {
    const p = latest.current;
    const m = host.metrics();
    p.onScroll?.(toScrollEvent(m));
    if (p.onStartReached && fired.current.start !== count && nearStart(m, p.onStartReachedThreshold)) {
      fired.current.start = count;
      p.onStartReached({ distanceFromStart: distanceFromStart(m) });
    }
    if (p.onEndReached && fired.current.end !== count && nearEnd(m, p.onEndReachedThreshold)) {
      fired.current.end = count;
      p.onEndReached({ distanceFromEnd: distanceFromEnd(m) });
    }
  }, [host, count]);
}

function useScrollSubscription<T>(props: VirtualListProps<T>, host: ScrollHost, check: () => void): void {
  const dragged = useRef(false);
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const onUserScroll = (): void => {
      if (dragged.current) return;
      dragged.current = true;
      latest.current.onScrollBeginDrag?.(toScrollEvent(host.metrics()));
    };
    window.addEventListener('wheel', onUserScroll, { passive: true });
    window.addEventListener('touchmove', onUserScroll, { passive: true });
    const unsubscribe = host.subscribe(check);
    return () => {
      window.removeEventListener('wheel', onUserScroll);
      window.removeEventListener('touchmove', onUserScroll);
      unsubscribe();
    };
  }, [host, check]);
}

function useContentObserver<T>(
  props: VirtualListProps<T>, refs: ListRefs, host: ScrollHost, setScrollMargin: (m: number) => void, check: () => void,
): void {
  const latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const content = refs.content.current;
    if (content === null) return;
    const observer = new ResizeObserver(() => {
      const items = refs.items.current;
      if (items !== null) setScrollMargin(host.itemsOffset(items));
      if (latest.current.stickToEnd?.() === true) host.scrollTo(endOffset(host.metrics()), false);
      check();
      latest.current.onContentSizeChange?.(content.clientWidth, host.metrics().contentHeight);
    });
    observer.observe(content);
    return () => { observer.disconnect(); };
  }, [refs, host, setScrollMargin, check]);
}

function useInitialPosition<T>(
  props: VirtualListProps<T>, host: ScrollHost, virtualizer: ListVirtualizer, count: number,
): void {
  const positioned = useRef(false);
  const { anchor, initialScrollIndex } = props;
  useLayoutEffect(() => {
    if (positioned.current || count === 0) return;
    positioned.current = true;
    if (anchor === 'end') {
      queueMicrotask(() => { host.scrollTo(endOffset(host.metrics()), false); });
      return;
    }
    if (initialScrollIndex !== undefined && initialScrollIndex !== null) {
      virtualizer.scrollToIndex(initialScrollIndex, { align: 'start' });
    }
  }, [anchor, initialScrollIndex, host, virtualizer, count]);
}

function rowElements(refs: ListRefs): HTMLElement[] {
  return Array.from(refs.items.current?.querySelectorAll<HTMLElement>('[data-index]') ?? []);
}

function viewportTop(refs: ListRefs, scroll: VirtualListProps<unknown>['scroll']): number {
  return scroll === 'self' ? (refs.root.current?.getBoundingClientRect().top ?? 0) : 0;
}

function visibleAnchor<T>(props: VirtualListProps<T>, refs: ListRefs, virtualizer: ListVirtualizer): ListAnchor | null {
  const top = viewportTop(refs, props.scroll);
  for (const el of rowElements(refs)) {
    const rect = el.getBoundingClientRect();
    if (rect.bottom <= top) continue;
    const index = Number(el.dataset.index);
    return { key: String(virtualizer.options.getItemKey(index)), offset: rect.top - top };
  }
  return null;
}

function scrollToAnchor<T>(
  props: VirtualListProps<T>, refs: ListRefs, host: ScrollHost, virtualizer: ListVirtualizer, anchor: ListAnchor,
): boolean {
  const count = props.data?.length ?? 0;
  let index = -1;
  for (let i = 0; i < count && index === -1; i++) {
    if (String(virtualizer.options.getItemKey(i)) === anchor.key) index = i;
  }
  if (index === -1) return false;
  virtualizer.scrollToIndex(index, { align: 'start' });
  const settle = (framesLeft: number, stableFrames: number): void => {
    const el = rowElements(refs).find((row) => row.dataset.index === String(index));
    if (el === undefined) return;
    const delta = el.getBoundingClientRect().top - viewportTop(refs, props.scroll) - anchor.offset;
    if (Math.abs(delta) > 1) host.scrollTo(host.metrics().offset + delta, false);
    const stable = Math.abs(delta) <= 1 ? stableFrames + 1 : 0;
    if (framesLeft > 0 && stable < 2) requestAnimationFrame(() => { settle(framesLeft - 1, stable); });
  };
  settle(ANCHOR_SETTLE_FRAMES, 0);
  return true;
}

function firstKeyOf<T>(props: VirtualListProps<T>, virtualizer: ListVirtualizer): string | null {
  return (props.data?.length ?? 0) > 0 ? String(virtualizer.options.getItemKey(0)) : null;
}

function keyIndexOf<T>(props: VirtualListProps<T>, virtualizer: ListVirtualizer, key: string): number {
  const count = props.data?.length ?? 0;
  for (let i = 0; i < count; i++) if (String(virtualizer.options.getItemKey(i)) === key) return i;
  return -1;
}

function usePrependAnchor<T>(
  props: VirtualListProps<T>, refs: ListRefs, host: ScrollHost, virtualizer: ListVirtualizer,
): () => void {
  const lastAnchor = useRef<ListAnchor | null>(null);
  const firstKey = useRef<string | null>(null);
  const remember = useCallback(() => {
    lastAnchor.current = props.maintainVisibleContentPosition == null ? null : visibleAnchor(props, refs, virtualizer);
  }, [props, refs, virtualizer]);
  useLayoutEffect(() => {
    const previous = firstKey.current;
    firstKey.current = firstKeyOf(props, virtualizer);
    const anchor = lastAnchor.current;
    if (previous === null || anchor === null || props.stickToEnd?.() === true || previous === firstKey.current) return;
    if (keyIndexOf(props, virtualizer, previous) > 0) scrollToAnchor(props, refs, host, virtualizer, anchor);
  }, [props.data, props, refs, host, virtualizer]);
  return remember;
}

function useListHandle<T>(
  handle: ForwardedRef<VirtualListHandle>, props: VirtualListProps<T>, refs: ListRefs,
  host: ScrollHost, virtualizer: ListVirtualizer,
): void {
  const latest = useRef(props);
  latest.current = props;
  useImperativeHandle(handle, () => ({
    scrollToOffset: ({ offset, animated }) => { host.scrollTo(offset, animated === true); },
    scrollToEnd: (params) => { host.scrollTo(endOffset(host.metrics()), params?.animated === true); },
    scrollToIndex: ({ index, animated, viewPosition }) => {
      const align = viewPosition === 1 ? 'end' : viewPosition === 0.5 ? 'center' : 'start';
      virtualizer.scrollToIndex(index, { align, behavior: animated === true ? 'smooth' : 'auto' });
    },
    visibleAnchor: () => visibleAnchor(latest.current, refs, virtualizer),
    scrollToAnchor: (anchor) => scrollToAnchor(latest.current, refs, host, virtualizer, anchor),
  }), [refs, host, virtualizer]);
}

function VirtualRows<T>({ props, refs, virtualizer }: {
  props: VirtualListProps<T>; refs: ListRefs; virtualizer: ListVirtualizer;
}): React.ReactElement {
  const data = useMemo(() => orderedData(props), [props]);
  const scrollMargin = virtualizer.options.scrollMargin;
  return (
    <div ref={refs.items} style={{ position: 'relative', height: virtualizer.getTotalSize() }}>
      {virtualizer.getVirtualItems().map((row) => {
        const item = data[row.index];
        if (item === undefined) return null;
        return (
          <div
            key={row.key}
            ref={virtualizer.measureElement}
            data-index={row.index}
            style={{ ...ITEM_STYLE, transform: `translateY(${itemTranslate(row.start, scrollMargin)}px)` }}
          >
            {props.renderItem?.({ item, index: sourceIndex(props, row.index, data.length), separators: SEPARATORS })}
          </div>
        );
      })}
    </div>
  );
}

function ListBody<T>({ props, handle, refs, host, virtualizer, setScrollMargin }: BodyProps<T>): React.ReactElement {
  const count = props.data?.length ?? 0;
  const edges = useEdgeCallbacks(props, host, count);
  const rememberAnchor = usePrependAnchor(props, refs, host, virtualizer);
  const check = useCallback(() => { edges(); rememberAnchor(); }, [edges, rememberAnchor]);
  useScrollSubscription(props, host, check);
  useContentObserver(props, refs, host, setScrollMargin, check);
  useInitialPosition(props, host, virtualizer, count);
  useListHandle(handle, props, refs, host, virtualizer);
  useEffect(() => { check(); }, [count, check]);
  return (
    <View
      ref={asViewRef(refs.root)}
      style={[{ flex: 1 }, props.style, props.scroll === 'self' ? SELF_SCROLL : null]}
      onLayout={props.onLayout}
    >
      <View ref={asViewRef(refs.content)} style={props.contentContainerStyle}>
        {renderSlot(props.ListHeaderComponent)}
        {count === 0 ? renderSlot(props.ListEmptyComponent) : <VirtualRows props={props} refs={refs} virtualizer={virtualizer} />}
        {renderSlot(props.ListFooterComponent)}
      </View>
    </View>
  );
}

function WindowList<T>({ props, handle }: { props: VirtualListProps<T>; handle: ForwardedRef<VirtualListHandle> }): React.ReactElement {
  const refs = useListRefs();
  const host = useMemo(() => windowHost(() => refs.content.current), [refs]);
  const [scrollMargin, setScrollMargin] = useState(0);
  const virtualizer = useWindowVirtualizer(virtualizerOptions(props, scrollMargin, window.innerHeight));
  return <ListBody props={props} handle={handle} refs={refs} host={host} virtualizer={virtualizer} setScrollMargin={setScrollMargin} />;
}

function SelfList<T>({ props, handle }: { props: VirtualListProps<T>; handle: ForwardedRef<VirtualListHandle> }): React.ReactElement {
  const refs = useListRefs();
  const host = useMemo(() => elementHost(() => refs.root.current), [refs]);
  const [scrollMargin, setScrollMargin] = useState(0);
  const virtualizer = useVirtualizer({
    ...virtualizerOptions(props, scrollMargin, refs.root.current?.clientHeight ?? 0),
    getScrollElement: () => refs.root.current,
  });
  return <ListBody props={props} handle={handle} refs={refs} host={host} virtualizer={virtualizer} setScrollMargin={setScrollMargin} />;
}

function VirtualListInner<T>(props: VirtualListProps<T>, ref: ForwardedRef<VirtualListHandle>): React.ReactElement {
  return props.scroll === 'self'
    ? <SelfList key="self" props={props} handle={ref} />
    : <WindowList key="window" props={props} handle={ref} />;
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: Ref<VirtualListHandle> },
) => React.ReactElement;
