import { View, type ViewStyle } from 'react-native';
import { flushBleed } from '../layout';
import { schemePalette } from '../tokens';
import { accessibilityProps, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { useKitScheme } from './theme-context';

export type DividerAxis = 'horizontal' | 'vertical';

export interface DividerProps extends A2uiCommonProps {
  axis?: DividerAxis;
  spacing?: number;
  color?: string;
  size?: number;
  flush?: number | boolean;
  dark?: boolean;
  style?: ViewStyle;
}

function lineStyle(axis: DividerAxis, size: number, spacing: number, bleed: number): ViewStyle {
  if (axis === 'vertical') return { width: size, alignSelf: 'stretch', marginHorizontal: spacing, marginVertical: bleed ? -bleed : 0 };
  return { height: size, marginVertical: spacing, marginHorizontal: bleed ? -bleed : 0 };
}

export function Divider(props: DividerProps): React.ReactElement {
  const scheme = useKitScheme();
  const { axis = 'horizontal', spacing = 0, color, size = 1, flush = false, dark = scheme === 'dark', style, weight, accessibility } = props;
  const base: ViewStyle = {
    ...lineStyle(axis, size, spacing, flushBleed(flush)),
    backgroundColor: color ?? schemePalette(dark).border,
    ...weightStyle(weight),
  };
  return <View {...accessibilityProps(accessibility)} style={style ? [base, style] : base} />;
}
