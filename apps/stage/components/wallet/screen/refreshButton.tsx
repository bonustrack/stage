import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { IconArrowRotateClockwise } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconArrowRotateClockwise';
import { HoverTooltip } from '../../HoverTooltip';

export function RefreshButton({ refreshing, onRefresh, color }: {
  refreshing: boolean;
  onRefresh: () => void;
  color: string;
}): React.ReactElement {
  const label = refreshing ? 'Refreshing balances' : 'Refresh balances';
  return (
    <HoverTooltip label={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ busy: refreshing, disabled: refreshing }}
        onPress={onRefresh}
        disabled={refreshing}
        hitSlop={10}
        style={({ pressed }) => ({ opacity: refreshing || pressed ? 0.5 : 1 })}
      >
        <Glyph icon={IconArrowRotateClockwise} size={24} color={color} />
      </Pressable>
    </HoverTooltip>
  );
}
