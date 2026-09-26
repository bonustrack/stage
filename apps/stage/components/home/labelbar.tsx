
import { useMemo, useState } from 'react';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { channelsLabelChips, selectChannelsFilter } from './model';
import { Box, Row, PAGE_GUTTER, LIST_TOP_GAP } from '../layout';
import { LabelChip } from '../LabelChip';
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

export { deriveBarLabels as deriveLabels } from '@stage-labs/client/xmtp/channelsFilter';

const CHIPS_PADDING = { x: PAGE_GUTTER, y: LIST_TOP_GAP };

export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll, panRef }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
  panRef?: SimultaneousRefs;
}): React.ReactElement {
  const chips = channelsLabelChips({ barLabels: labels, enabledLabels: enabled, unreadOnly });
  const select = (value: string): void => {
    selectChannelsFilter({ onClearAll, onToggleUnread, onToggleLabel: onToggle }, value);
  };

  const gesture = useMemo(
    () => (panRef ? Gesture.Native().simultaneousWithExternalGesture(panRef) : Gesture.Native()),
    [panRef],
  );

  return (
    <GestureDetector gesture={gesture}>
      <Box style={{ alignSelf: 'stretch' }}>
        <Scroll horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={8} padding={CHIPS_PADDING}>
            {chips.map((chip) => (
              <GesturePressable key={chip.value === '' ? '__all__' : chip.value} onPress={() => { select(chip.value); }}>
                <LabelChip label={chip.label} selected={chip.selected === true} />
              </GesturePressable>
            ))}
          </Row>
        </Scroll>
      </Box>
    </GestureDetector>
  );
}
