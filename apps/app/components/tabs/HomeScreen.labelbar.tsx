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
  const toggleLabel = (label: string): void => setEnabledLabels(prev => {
    const next = new Set(prev), key = label.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  });
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  const toggleUnread = (): void => setUnreadOnly(v => !v);
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
  /** The tabs pager's Pan ref. The chip row's own native scroll BLOCKS it, so a
   *  horizontal drag over the chips scrolls the chips instead of flipping the
   *  page. (Opposite of the vertical FlatList, which runs SIMULTANEOUSLY with the
   *  pager - a vertical-or-horizontal coexistence vs. this strict capture.) */
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const { link, text: fg, bg, border: rowBg } = usePalette();
  const allSelected = !unreadOnly && enabled.size === 0;

  /** Edge-release blocker (worklet-free). A single `Gesture.Native()` over the
   *  chip row that `blocksExternalGesture(panRef)` - so while it is ENABLED the
   *  pager Pan must wait for the chip scroll to fail, and a horizontal drag over
   *  the chips scrolls the chips instead of flipping the page. We toggle it OFF
   *  when the row is parked AT AN EDGE (or its content fits with nothing to
   *  scroll); then the pager is no longer blocked and the swipe pages the screen.
   *
   *  All toggling is driven from the ScrollView's `onScroll`/`onLayout`/
   *  `onContentSizeChange` - plain JS-thread callbacks, NOT gesture worklets - so
   *  there is no UI-thread/worklet boundary to cross. (The earlier direction probe
   *  ran its onBegin/onTouchesMove as worklets and synchronously called JS, which
   *  threw "[Worklets] Tried to synchronously call a non-worklet function".)
   *
   *  Tradeoff vs. the direction-aware probe: at an edge BOTH directions page, so a
   *  drag back into the still-scrollable range pages instead of scrolling. Once
   *  any scroll moves the row off the edge the blocker re-arms and chips scroll
   *  again. Stability over precision - this row is scrolled constantly. */
  const [atEdge, setAtEdge] = useState(true); // fresh ScrollView sits at offset 0 (left edge)
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.width - layoutMeasurement.width;
    const edge = max <= 0.5 || contentOffset.x <= 0.5 || contentOffset.x >= max - 0.5;
    setAtEdge(prev => (prev === edge ? prev : edge));
  };
  /** When content fits (no overflow) there is nothing to scroll, so always page.
   *  layoutWRef caches the last measured viewport width so onContentSizeChange can
   *  compare against it without an onScroll having fired yet. */
  const layoutWRef = useRef(0);
  const onMeasure = (contentW: number, layoutW: number): void => {
    if (layoutW <= 0) return;
    if (contentW - layoutW <= 0.5) setAtEdge(true);
  };

  const blockerOn = !atEdge;
  const chipScroll = useMemo(
    () => {
      const g = panRef ? Gesture.Native().blocksExternalGesture(panRef) : Gesture.Native();
      return g.enabled(blockerOn);
    },
    [panRef, blockerOn],
  );

  const bar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onContentSizeChange={(w) => onMeasure(w, layoutWRef.current)}
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
          onPress={() => onToggle(label)}
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
