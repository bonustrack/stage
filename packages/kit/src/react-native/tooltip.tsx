import { Platform, View, type ViewStyle } from 'react-native';
import { kitPalette, type KitPalette } from '../tokens';
import { OVERLAY_DROP_SHADOW, OVERLAY_SHADOW } from '../overlay.styles';
import { Text } from './text';
import { useKitPalette } from './theme-context';

export const TOOLTIP = { padX: 14, padY: 8, radius: 4, lineHeight: 20, arrow: 8 } as const;

export type TooltipArrow = 'left' | 'up' | 'down' | 'none';

export interface TooltipProps {
  label: string;
  arrow?: TooltipArrow;
  dark?: boolean;
  background?: string;
  color?: string;
  bubbleOffset?: number;
  onBubbleWidth?: (width: number) => void;
  style?: ViewStyle;
}

function usePalette(dark: boolean | undefined): KitPalette {
  const context = useKitPalette();
  if (dark === undefined) return context;
  return kitPalette(dark ? 'dark' : 'light');
}

function arrowStyle(side: Exclude<TooltipArrow, 'none'>, color: string): ViewStyle {
  const a = TOOLTIP.arrow;
  if (side === 'left') {
    return {
      borderTopWidth: a, borderBottomWidth: a, borderRightWidth: a,
      borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color,
    };
  }
  const sides: ViewStyle = { borderLeftWidth: a, borderRightWidth: a, borderLeftColor: 'transparent', borderRightColor: 'transparent' };
  return side === 'down'
    ? { ...sides, borderTopWidth: a, borderTopColor: color }
    : { ...sides, borderBottomWidth: a, borderBottomColor: color };
}

const ARROW_FIRST: readonly TooltipArrow[] = ['left', 'up'];

const SHAPE_SHADOW: ViewStyle = Platform.OS === 'web' ? { filter: OVERLAY_DROP_SHADOW } : OVERLAY_SHADOW;

export function Tooltip({ label, arrow = 'down', dark, background, color, bubbleOffset = 0, onBubbleWidth, style }: TooltipProps): React.ReactElement {
  const pal = usePalette(dark);
  const fill = background ?? pal.border;
  const arrowBox = arrow === 'none' ? null : <View style={{ width: 0, height: 0, ...arrowStyle(arrow, fill) }} />;
  const arrowFirst = ARROW_FIRST.includes(arrow);
  return (
    <View style={[{ flexDirection: arrow === 'left' ? 'row' : 'column', alignItems: 'center', ...SHAPE_SHADOW }, style]}>
      {arrowFirst ? arrowBox : null}
      <View
        style={{
          backgroundColor: fill, borderRadius: TOOLTIP.radius,
          paddingHorizontal: TOOLTIP.padX, paddingVertical: TOOLTIP.padY,
          transform: [{ translateX: bubbleOffset }],
        }}
        onLayout={(e) => { onBubbleWidth?.(e.nativeEvent.layout.width); }}
      >
        <Text size="xl" color={color ?? pal.link} numberOfLines={1} style={{ lineHeight: TOOLTIP.lineHeight }}>{label}</Text>
      </View>
      {arrowFirst ? null : arrowBox}
    </View>
  );
}
