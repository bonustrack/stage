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
import type { VirtualListHandle, VirtualListProps } from './VirtualList.types';

const ESTIMATED_ITEM_SIZE = 72;
const OVERSCAN = 6;
const END_PIN_THRESHOLD_PX = 2;
const SEPARATORS = { highlight: () => undefined, unhighlight: () => undefined, updateProps: () => undefined };
const SELF_SCROLL = { overflowY: 'auto' } as unknown as ViewStyle;
const ITEM_STYLE = { position: 'absolute', top: 0, left: 0, width: '100%' } as const;

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
  const end = props.anchor === 'end';
  return {
    count,
    estimateSize: () => estimate,
    overscan: OVERSCAN,
    scrollMargin,
    getItemKey: (index: number) => {
      const item = data[index];
      return keyOf !== undefined && item !== undefined ? keyOf(item, sourceIndex(props, index, count)) : index;
    },
    anchorTo: end ? 'end' as const : 'start' as const,
    followOnAppend: false,
    initialOffset: end ? Math.max(0, count * estimate - viewport) : 0,
  };
}

function useEdgeCallbacks<T>(
  props: VirtualListProps<T>, host: ScrollHost, count: number, atEnd: RefObject<boolean>,
): () => void {
  const fired = useRef({ start: -1, end: -1 });
  const latest = useRef(props);
  latest.current = props;
  return useCallback(() => {
    const p = latest.current;
    const m = host.metrics();
    atEnd.current = distanceFromEnd(m) <= END_PIN_THRESHOLD_PX;
    p.onScroll?.(toScrollEvent(m));
    if (p.onStartReached && fired.current.start !== count && nearStart(m, p.onStartReachedThreshold)) {
      fired.current.start = count;
      p.onStartReached({ distanceFromStart: distanceFromStart(m) });
    }
    if (p.onEndReached && fired.current.end !== count && nearEnd(m, p.onEndReachedThreshold)) {
      fired.current.end = count;
      p.onEndReached({ distanceFromEnd: distanceFromEnd(m) });
    }
  }, [host, count, atEnd]);
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
  props: VirtualListProps<T>, refs: ListRefs, host: ScrollHost, setScrollMargin: (m: number) => void,
  check: () => void, atEnd: RefObject<boolean>,
): void {
  const latest = useRef(props);
  latest.current = props;
  useLayoutEffect(() => {
    const content = refs.content.current;
    if (content === null) return;
    const observer = new ResizeObserver(() => {
      const items = refs.items.current;
      if (items !== null) setScrollMargin(host.itemsOffset(items));
      const m = host.metrics();
      if (latest.current.anchor === 'end' && atEnd.current) host.scrollTo(endOffset(m), false);
      latest.current.onContentSizeChange?.(content.clientWidth, m.contentHeight);
      check();
    });
    observer.observe(content);
    return () => { observer.disconnect(); };
  }, [refs, host, setScrollMargin, check, atEnd]);
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

function useListHandle(
  handle: ForwardedRef<VirtualListHandle>, host: ScrollHost, virtualizer: ListVirtualizer,
): void {
  useImperativeHandle(handle, () => ({
    scrollToOffset: ({ offset, animated }) => { host.scrollTo(offset, animated === true); },
    scrollToEnd: (params) => { host.scrollTo(endOffset(host.metrics()), params?.animated === true); },
    scrollToIndex: ({ index, animated, viewPosition }) => {
      const align = viewPosition === 1 ? 'end' : viewPosition === 0.5 ? 'center' : 'start';
      virtualizer.scrollToIndex(index, { align, behavior: animated === true ? 'smooth' : 'auto' });
    },
  }), [host, virtualizer]);
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
  const atEnd = useRef(false);
  const check = useEdgeCallbacks(props, host, count, atEnd);
  useScrollSubscription(props, host, check);
  useContentObserver(props, refs, host, setScrollMargin, check, atEnd);
  useInitialPosition(props, host, virtualizer, count);
  useListHandle(handle, host, virtualizer);
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
