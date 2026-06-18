/** Home label-filter bar - a horizontally scrollable row of chips rendered
 *  directly under the search bar (the channels list's ListHeaderComponent, so it
 *  scrolls with the feed).
 *
 *  Built-in chips lead the bar: "All" (clears every filter; the default state)
 *  then "Unread" (narrows the list to conversations with unread messages). After
 *  them comes one chip per UNIQUE label across all NON-ARCHIVED channels; each
 *  label chip toggles a filter on/off and the list narrows to chats carrying ANY
 *  enabled label (OR semantics), AND-combined with the Unread filter.
 *
 *  Selected chips render INVERTED: their text takes the bg palette color on a
 *  link-colored fill, so the active filter(s) stand out. Unselected chips keep
 *  the tinted-border style. Presentation only - the filter state is owned by
 *  HomeScreen and passed down. */

import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Text } from '@metro-labs/kit/text';
import { usePalette } from '../../lib/theme';
import type { SimultaneousRefs } from '../SwipeTabs.types';

/** Home filter state: the enabled label set (OR-filter), the built-in Unread
 *  toggle, and their handlers. "All" = clearAll back to the empty/default
 *  state. Extracted from HomeScreen so the screen body stays under the line cap. */
export function useHomeFilters(): {
  enabledLabels: Set<string>;
  toggleLabel: (label: string) => void;
  unreadOnly: boolean;
  toggleUnread: () => void;
  clearAllFilters: () => void;
} {
  const [enabledLabels, setEnabledLabels] = useState<Set<string>>(new Set());
  const toggleLabel = (label: string): void => { setEnabledLabels(prev => {
    const next = new Set(prev), key = label.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }); };
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const toggleUnread = (): void => { setUnreadOnly(v => !v); };
  const clearAllFilters = (): void => { setEnabledLabels(new Set()); setUnreadOnly(false); };
  return { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters };
}

/** Derive the unique label set (case-insensitive, first-seen casing preserved)
 *  across the supplied rows. Callers pass NON-ARCHIVED rows only. */
export function deriveLabels(rows: { labels?: string[] }[]): string[] {
  const seen = new Map<string, string>();
  for (const r of rows) {
    for (const label of r.labels ?? []) {
      const key = label.toLowerCase();
      if (!seen.has(key)) seen.set(key, label);
    }
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

/** A single chip. Selected = inverted (bg-colored text on a link fill);
 *  unselected = fg text on a tinted-border chip. */
function Chip({ label, selected, onPress, link, fg, bg, rowBg }: {
  label: string;
  selected: boolean;
  onPress: () => void;
  link: string;
  fg: string;
  bg: string;
  rowBg: string;
}): React.ReactElement {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({
        height: 26, borderRadius: 999, paddingHorizontal: 9, paddingVertical: 2,
        justifyContent: 'center',
        backgroundColor: selected ? link : rowBg,
        opacity: pressed ? 0.7 : 1, flexShrink: 0,
      })}
    >
      <Text size="md"
        numberOfLines={1} color={selected ? bg : fg}>
        {label}
      </Text>
    </Pressable>
  );
}

/** The horizontal filter bar. Always rendered (All + Unread are built-in even
 *  with no labels). `unreadOnly` drives the Unread chip; `enabled` drives the
 *  label chips. "All" is selected when neither filter is active. */
export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll, panRef }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
  /** The tabs pager's Pan ref. The chip row's own native scroll normally BLOCKS
   *  it, so a horizontal drag over the chips scrolls the chips. We RELEASE the
   *  block (hand the swipe to the pager) only when the drag heads off the edge the
   *  row is parked at - see `chipScroll`. */
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const { link, text: fg, bg, border: rowBg } = usePalette();
  const allSelected = !unreadOnly && enabled.size === 0;

  /** Symmetric, direction-aware edge release.
   *
   *  The chip row's native scroll gesture `blocksExternalGesture(panRef)`, so by
   *  default a horizontal drag over the chips scrolls the chips and never pages.
   *  We hand the gesture to the pager ONLY when the drag cannot scroll the row any
   *  further in that direction:
   *    - parked at the START edge -> only a left-to-right swipe (dx > 0) pages;
   *    - parked at the END edge   -> only a right-to-left swipe (dx < 0) pages.
   *  Anywhere mid-range, or for a swipe pointing back INTO scrollable range, the
   *  chips keep scrolling. This fixes the old binary blocker, which only tracked
   *  the END edge (one direction) so left-to-right page swipes misbehaved.
   *
   *  Edge state comes from the ScrollView's `onScroll`/`onLayout`/
   *  `onContentSizeChange` - plain JS-thread callbacks, never gesture worklets. A
   *  ~2px epsilon absorbs sub-pixel/momentum offsets that leave the row a hair
   *  short of the true boundary; scrollEventThrottle 16 keeps the state current. */
  const [atStart, setAtStart] = useState(true);  // a fresh ScrollView sits at the left (start) edge
  const [atEnd, setAtEnd] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.width - layoutMeasurement.width;
    const fits = max <= 2;                       // content fits -> nothing to scroll, both edges
    const start = fits || contentOffset.x <= 2;
    const end = fits || contentOffset.x >= max - 2;
    setAtStart(prev => (prev === start ? prev : start));
    setAtEnd(prev => (prev === end ? prev : end));
  };
  /** When content fits the viewport there is nothing to scroll, so BOTH edges are
   *  true (any swipe pages). layoutWRef caches the last measured viewport width so
   *  onContentSizeChange can decide before any onScroll has fired. */
  const layoutWRef = useRef(0);
  const onMeasure = (contentW: number, layoutW: number): void => {
    if (layoutW <= 0) return;
    if (contentW - layoutW <= 2) { setAtStart(true); setAtEnd(true); }
  };

  /** `release` (JS state) decides which pager direction the chip row hands off to:
   *  -1 lets a right-to-left (next-tab) swipe page, +1 lets a left-to-right
   *  (prev-tab) swipe page, 0 blocks both (chips scroll). It is flipped by the
   *  probe the instant it detects a directional off-edge drag, and reset on touch
   *  end. */
  const [release, setRelease] = useState(0);
  /** UI-thread mirror of the edge booleans + a one-decision-per-gesture latch,
   *  read/written inside the probe worklet (no per-frame JS-bridge hop). */
  const atStartSV = useSharedValue(true);
  const atEndSV = useSharedValue(false);
  const decidedSV = useSharedValue(false);
  atStartSV.value = atStart;
  atEndSV.value = atEnd;

  const chipScroll = useMemo(() => {
    /** Native chip scroll. By default it `blocksExternalGesture(panRef)`, so the
     *  pager Pan must wait for it to fail - a horizontal drag over the chips
     *  scrolls the chips. While parked at an edge the row cannot scroll in the
     *  off-edge direction, so the native gesture never activates and the pager
     *  stays WAITING; the probe then DROPS the block (plain Gesture.Native, runs
     *  simultaneously), letting the pager's own activeOffsetX arm and page within
     *  the same continuous drag. */
    const blocking = panRef && release === 0;
    const native = blocking
      ? Gesture.Native().blocksExternalGesture(panRef)
      : Gesture.Native();
    if (!panRef) return native;
    /** Direction + edge probe: a Pan running SIMULTANEOUSLY with the native scroll
     *  and the pager (it never moves anything itself). On the first clearly-
     *  horizontal delta it decides ENTIRELY INLINE (no imported worklet helpers):
     *  off the START edge with dx>0, or off the END edge with dx<0, it flips
     *  `release` to that direction via a single async `runOnJS` - never a
     *  synchronous UI-thread->JS call. Otherwise the chips keep scrolling. The
     *  decision latches once per gesture and resets on finalize. */
    const probe = Gesture.Pan()
      .simultaneousWithExternalGesture(panRef)
      .onBegin(() => {
        'worklet';
        decidedSV.value = false;
      })
      .onUpdate((e) => {
        'worklet';
        if (decidedSV.value) return;
        const dx = e.translationX;
        const dy = e.translationY;
        if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return; // not yet clearly horizontal
        decidedSV.value = true;
        if (atStartSV.value && dx > 0) runOnJS(setRelease)(1);
        else if (atEndSV.value && dx < 0) runOnJS(setRelease)(-1);
      })
      .onFinalize(() => {
        'worklet';
        decidedSV.value = false;
        runOnJS(setRelease)(0);
      });
    return Gesture.Simultaneous(native, probe);
  }, [panRef, release, atStartSV, atEndSV, decidedSV]);

  const bar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onContentSizeChange={(w) => { onMeasure(w, layoutWRef.current); }}
      onLayout={(e) => { layoutWRef.current = e.nativeEvent.layout.width; }}
      /** flexGrow:0 + alignSelf:stretch keep the bar hugging its single chip
       *  row; without them the horizontal ScrollView stretches to fill the column
       *  and the chips drift to the vertical middle of the empty list area. */
      style={{ flexGrow: 0, alignSelf: 'stretch' }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 7, alignItems: 'center' }}
    >
      <Chip label="All" selected={allSelected} onPress={onClearAll} link={link} fg={fg} bg={bg} rowBg={rowBg} />
      <Chip label="Unread" selected={unreadOnly} onPress={onToggleUnread} link={link} fg={fg} bg={bg} rowBg={rowBg} />
      {labels.map(label => (
        <Chip
          key={label.toLowerCase()}
          label={label}
          selected={enabled.has(label.toLowerCase())}
          onPress={() => { onToggle(label); }}
          link={link}
          fg={fg}
          bg={bg}
          rowBg={rowBg}
        />
      ))}
    </ScrollView>
  );
  return <GestureDetector gesture={chipScroll}>{bar}</GestureDetector>;
}
