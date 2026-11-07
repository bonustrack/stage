import { useMemo } from 'react';
import { Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { GesturePressable } from '@stage-labs/kit/react-native/gesture-pressable';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { channelsLabelChips, selectChannelsFilter } from './model';
import { LabelChip } from '../LabelChip';
import { List } from '@stage-labs/kit/react-native/list';
import { Column, Row, PAGE_GUTTER, LIST_TOP_GAP } from '../layout';

const CHIPS_PADDING = { x: PAGE_GUTTER, y: LIST_TOP_GAP };
const STRETCH = { alignSelf: 'stretch' } as const;
const WEB = Platform.OS === 'web';
const ChipPress = WEB ? GesturePressable : Pressable;

export function LabelFilterBar({
  labels,
  enabled,
  unreadOnly,
  onToggle,
  onToggleUnread,
  onClearAll,
}: {
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

  const gesture = useMemo(() => (WEB ? Gesture.Native() : Gesture.Native().disallowInterruption(true).shouldCancelWhenOutside(false)), []);

  const scroll = (
    <List direction="horizontal" showsHorizontalScrollIndicator={false}>
      <Row gap={8} padding={CHIPS_PADDING}>
        {chips.map((chip) => (
          <ChipPress
            key={chip.value === '' ? '__all__' : chip.value}
            onPress={() => {
              select(chip.value);
            }}
          >
            <LabelChip label={chip.label} selected={chip.selected === true} size="md" />
          </ChipPress>
        ))}
      </Row>
    </List>
  );

  return WEB ? (
    <GestureDetector gesture={gesture}>
      <Column style={STRETCH}>{scroll}</Column>
    </GestureDetector>
  ) : (
    <Column style={STRETCH}>
      <GestureDetector gesture={gesture}>{scroll}</GestureDetector>
    </Column>
  );
}
