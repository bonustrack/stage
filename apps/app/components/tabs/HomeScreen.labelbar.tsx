
import { useMemo, useRef, useState } from 'react';
import type { NativeScrollEvent, NativeSyntheticEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll as ScrollView } from '@stage-labs/kit/react-native/scroll';
import { Text } from '@stage-labs/kit/react-native/text';
import { usePalette } from '../../lib/theme';
import type { SimultaneousRefs } from '../SwipeTabs.types';

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

export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll, panRef }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const { link, text: fg, bg, border: rowBg } = usePalette();
  const allSelected = !unreadOnly && enabled.size === 0;

  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>): void => {
    const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
    const max = contentSize.width - layoutMeasurement.width;
    const fits = max <= 2;
    const start = fits || contentOffset.x <= 2;
    const end = fits || contentOffset.x >= max - 2;
    setAtStart(prev => (prev === start ? prev : start));
    setAtEnd(prev => (prev === end ? prev : end));
  };
  const layoutWRef = useRef(0);
  const onMeasure = (contentW: number, layoutW: number): void => {
    if (layoutW <= 0) return;
    if (contentW - layoutW <= 2) { setAtStart(true); setAtEnd(true); }
  };

  const [release, setRelease] = useState(0);
  const atStartSV = useSharedValue(true);
  const atEndSV = useSharedValue(false);
  const decidedSV = useSharedValue(false);
  atStartSV.value = atStart;
  atEndSV.value = atEnd;

  const chipScroll = useMemo(() => {
    const blocking = panRef && release === 0;
    const native = blocking
      ? Gesture.Native().blocksExternalGesture(panRef)
      : Gesture.Native();
    if (!panRef) return native;
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
