
import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { channelsLabelChips, selectChannelsFilter } from './model';
import { Box, Row, PAGE_GUTTER, LIST_TOP_GAP } from '../layout';
import { LabelChip } from '../LabelChip';
import {
  clearSearchFilters, setSearchQuery, toggleSearchLabel, toggleSearchUnread, useSearchState,
} from '../../lib/searchState';


export function useHomeFilters(): {
  enabledLabels: Set<string>;
  toggleLabel: (label: string) => void;
  unreadOnly: boolean;
  toggleUnread: () => void;
  clearAllFilters: () => void;
  query: string;
  setQuery: (query: string) => void;
} {
  const search = useSearchState();
  const enabledLabels = useMemo(() => new Set(search.labels), [search.labels]);
  return {
    enabledLabels, toggleLabel: toggleSearchLabel, unreadOnly: search.unreadOnly, toggleUnread: toggleSearchUnread,
    clearAllFilters: clearSearchFilters, query: search.query, setQuery: setSearchQuery,
  };
}

const CHIPS_PADDING = { x: PAGE_GUTTER, y: LIST_TOP_GAP };
const STRETCH = { alignSelf: 'stretch' } as const;
const WEB = Platform.OS === 'web';
const ChipPress = WEB ? GesturePressable : Pressable;

export function LabelFilterBar({ labels, enabled, unreadOnly, onToggle, onToggleUnread, onClearAll }: {
  labels: string[];
  enabled: Set<string>;
  unreadOnly: boolean;
  onToggle: (label: string) => void;
  onToggleUnread: () => void;
  onClearAll: () => void;
}): React.ReactElement {
  const chips = channelsLabelChips({ barLabels: labels, enabledLabels: enabled, unreadOnly });
  const select = (value: string): void => {
    selectChannelsFilter({ onClearAll, onToggleUnread, onToggleLabel: onToggle }, value);
  };

  const gesture = useMemo(
    () => (WEB ? Gesture.Native() : Gesture.Native().disallowInterruption(true).shouldCancelWhenOutside(false)),
    [],
  );

  const scroll = (
    <Scroll horizontal showsHorizontalScrollIndicator={false}>
      <Row gap={8} padding={CHIPS_PADDING}>
        {chips.map((chip) => (
          <ChipPress key={chip.value === '' ? '__all__' : chip.value} onPress={() => { select(chip.value); }}>
            <LabelChip label={chip.label} selected={chip.selected === true} size="md" />
          </ChipPress>
        ))}
      </Row>
    </Scroll>
  );

  return WEB ? (
    <GestureDetector gesture={gesture}>
      <Box style={STRETCH}>{scroll}</Box>
    </GestureDetector>
  ) : (
    <Box style={STRETCH}>
      <GestureDetector gesture={gesture}>{scroll}</GestureDetector>
    </Box>
  );
}
