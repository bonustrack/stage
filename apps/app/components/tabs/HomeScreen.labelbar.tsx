/** @file HomeScreen.labelbar — the horizontally scrollable Home filter chip bar (All / Unread plus one chip per unique non-archived label) plus useHomeFilters, with OR across labels AND-combined with Unread; filter state lives in HomeScreen. */

import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { Pressable } from '@metro-labs/kit/pressable';
import { Scroll as ScrollView } from '@metro-labs/kit/scroll';
import { Text } from '@metro-labs/kit/text';
import { usePalette } from '../../lib/theme';
import type { SimultaneousRefs } from '../SwipeTabs.types';

/** Home filter state: the enabled label set (OR-filter), the built-in Unread toggle, and their handlers. "All" = clearAll back to the empty/default state. Extracted from HomeScreen so the screen body stays under the line cap. */
export function useHomeFilters(): {
  enabledLabels: Set<string>;
  toggleLabel: (label: string) => void;
  unreadOnly: boolean;
  toggleUnread: () => void;
  clearAllFilters: () => void;
} {
  const [enabledLabels, setEnabledLabels] = useState<Set<string>>(new Set());
  /** Toggle Label. */
  const toggleLabel = (label: string): void => { setEnabledLabels(prev => {
    const next = new Set(prev), key = label.toLowerCase();
    if (next.has(key)) next.delete(key); else next.add(key);
    return next;
  }); };
  const [unreadOnly, setUnreadOnly] = useState<boolean>(false);
  /** Toggle Unread. */
  const toggleUnread = (): void => { setUnreadOnly(v => !v); };
  /** Clear All Filters. */
  const clearAllFilters = (): void => { setEnabledLabels(new Set()); setUnreadOnly(false); };
  return { enabledLabels, toggleLabel, unreadOnly, toggleUnread, clearAllFilters };
}

/** Derive the unique label set (case-insensitive, first-seen casing preserved) across the supplied rows. Callers pass NON-ARCHIVED rows only. */
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

/** A single chip. Selected = inverted (bg-colored text on a link fill); unselected = fg text on a tinted-border chip. */
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

/** The horizontal filter bar. Always rendered (All + Unread are built-in even with no labels). `unreadOnly` drives the Unread chip; `enabled` drives the label chips. "All" is selected when neither filter is active. */
export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll, panRef }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
  /** The tabs pager's Pan ref; the chip row's native scroll normally blocks it, and the block is released (swipe handed to the pager) only when the drag heads off the parked edge - see `chipScroll`. */
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const { link, text: fg, bg, border: rowBg } = usePalette();
  const allSelected = !unreadOnly && enabled.size === 0;

  /** Symmetric, direction-aware edge release: the chips' native scroll blocks the pager, handing off only at a parked edge for the off-edge swipe direction (start->dx>0, end->dx<0); edge state comes from onScroll/onLayout/onContentSizeChange with a ~2px epsilon. */
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  /** Handle the Scroll. */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.width - layoutMeasurement.width;
    /** content fits -> nothing to scroll, both edges true */
    const fits = max <= 2;
    const start = fits || contentOffset.x <= 2;
    const end = fits || contentOffset.x >= max - 2;
    setAtStart(prev => (prev === start ? prev : start));
    setAtEnd(prev => (prev === end ? prev : end));
  };
  /** When content fits the viewport there is nothing to scroll, so BOTH edges are true (any swipe pages). layoutWRef caches the last measured viewport width so onContentSizeChange can decide before any onScroll has fired. */
  const layoutWRef = useRef(0);
  /** Handle the Measure. */
  const onMeasure = (contentW: number, layoutW: number): void => {
    if (layoutW <= 0) return;
    if (contentW - layoutW <= 2) { setAtStart(true); setAtEnd(true); }
  };

  /** `release` (JS state) picks the pager hand-off direction: -1 pages a right-to-left swipe, +1 a left-to-right swipe, 0 blocks both; flipped by the probe on a directional off-edge drag and reset on touch end. */
  const [release, setRelease] = useState(0);
  /** UI-thread mirror of the edge booleans + a one-decision-per-gesture latch, read/written inside the probe worklet (no per-frame JS-bridge hop). */
  const atStartSV = useSharedValue(true);
  const atEndSV = useSharedValue(false);
  const decidedSV = useSharedValue(false);
  atStartSV.value = atStart;
  atEndSV.value = atEnd;

  const chipScroll = useMemo(() => {
    /** Native chip scroll blocksExternalGesture(panRef) so the pager waits; parked at an edge the native gesture never activates and the probe drops the block (plain Gesture.Native) so the pager can arm and page within the same drag. */
    const blocking = panRef && release === 0;
    const native = blocking
      ? Gesture.Native().blocksExternalGesture(panRef)
      : Gesture.Native();
    if (!panRef) return native;
    /** Direction + edge probe: a Pan running simultaneously with the native scroll and pager that, on the first clearly-horizontal delta, flips `release` (start edge + dx>0, or end edge + dx<0) via one async runOnJS; latches once per gesture, resets on finalize. */
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
        /** not yet clearly horizontal */
        if (Math.abs(dx) < 6 || Math.abs(dx) <= Math.abs(dy)) return;
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
      /** flexGrow:0 + alignSelf:stretch keep the bar hugging its single chip row; without them the horizontal ScrollView stretches to fill the column and the chips drift to the vertical middle of the empty list area. */
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
