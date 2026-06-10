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

  /** Live scroll-edge state, kept in refs (no re-render). `atStart` once the row
   *  is scrolled all the way left, `atEnd` once all the way right. Both true when
   *  the content fits without scrolling (every drag should then page). Seeded
   *  atStart=true because a fresh ScrollView sits at offset 0; atEnd flips true on
   *  the first onScroll/onContentSizeChange if the row is short enough to fit. */
  const atStart = useRef(true);
  const atEnd = useRef(false);
  const recomputeEnd = (): void => {
    const max = contentW.current - layoutW.current;
    if (max <= 0.5) atEnd.current = true; // content fits: every drag can page
  };
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.width - layoutMeasurement.width;
    atStart.current = contentOffset.x <= 0.5;
    atEnd.current = max <= 0.5 || contentOffset.x >= max - 0.5;
  };
  const contentW = useRef(0);
  const layoutW = useRef(0);

  /** Native scroll gesture for the chip row. `blocksExternalGesture(panRef)`
   *  makes the pager Pan WAIT for this scroll to fail before it can arm, so while
   *  the finger is dragging the chips the page never swipes. The blocking is made
   *  DIRECTION-AWARE via the companion probe Pan below: while the native scroll is
   *  still in its BEGAN (not-yet-scrolling) phase, the probe inspects the first
   *  few px of finger movement; if the row is parked at the edge it CANNOT scroll
   *  toward (left edge + rightward drag, or right edge + leftward drag) it flips
   *  `blockerOn` false. That disables THIS gesture before it activates, so the
   *  pager - which was only waiting on it - is released and the screen pages. Any
   *  drag the row can still consume leaves `blockerOn` true and the chips scroll.
   *  Reset to true on every touch end so the next drag starts capturing again. */
  const [blockerOn, setBlockerOn] = useState(true);
  const chipScroll = useMemo(
    () => {
      const g = panRef ? Gesture.Native().blocksExternalGesture(panRef) : Gesture.Native();
      return g.enabled(blockerOn);
    },
    [panRef, blockerOn],
  );
  /** Direction probe. A manual Pan that NEVER activates (manualActivation + never
   *  calling activate), so it cannot steal the touch from the native scroll or the
   *  pager; it only observes. It records the first touch point, then on the first
   *  movement past an 8px intent threshold decides whether to release the blocker.
   *  Runs simultaneously with everything. */
  const probeOrigin = useRef<{ x: number; y: number } | null>(null);
  const decided = useRef(false);
  const probe = useMemo(
    () =>
      Gesture.Pan()
        .manualActivation(true)
        .onBegin(() => { decided.current = false; probeOrigin.current = null; recomputeEnd(); })
        .onTouchesMove((e) => {
          if (decided.current) return;
          const t = e.allTouches[0];
          if (!t) return;
          if (!probeOrigin.current) { probeOrigin.current = { x: t.x, y: t.y }; return; }
          const moveX = t.x - probeOrigin.current.x;
          const moveY = t.y - probeOrigin.current.y;
          if (Math.abs(moveX) < 8 && Math.abs(moveY) < 8) return; // wait for clear intent
          decided.current = true;
          // Vertical-first drag never pages; keep the blocker on (vertical scroll
          // of the parent list is handled by its own simultaneous relation).
          if (Math.abs(moveY) >= Math.abs(moveX)) return;
          const cannotScroll =
            (moveX > 0 && atStart.current) || (moveX < 0 && atEnd.current);
          if (cannotScroll) setBlockerOn(false);
        })
        .onFinalize(() => { probeOrigin.current = null; decided.current = false; setBlockerOn(true); }),
    [],
  );

  const bar = (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      onScroll={onScroll}
      onContentSizeChange={(w) => { contentW.current = w; recomputeEnd(); }}
      onLayout={(e) => { layoutW.current = e.nativeEvent.layout.width; recomputeEnd(); }}
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
  /** Native scroll + the observe-only probe run simultaneously: the probe must
   *  see touches without competing with the scroll. */
  const composed = useMemo(() => Gesture.Simultaneous(chipScroll, probe), [chipScroll, probe]);
  return <GestureDetector gesture={composed}>{bar}</GestureDetector>;
}
