
import { View, type ViewStyle } from 'react-native';

export interface DividerProps {
  spacing?: number;
  color?: string;
  size?: number;
  flush?: number | boolean;
  dark: boolean;
  style?: ViewStyle;
}

function borderColor(dark: boolean): string {
  return dark ? '#282a2d' : '#e4e4e5';
}

export function Divider(props: DividerProps): React.ReactElement {
  const { spacing = 0, color, size = 1, flush = false, dark, style } = props;
  const bleed = flush === true ? 16 : typeof flush === 'number' ? flush : 0;

  const base: ViewStyle = {
    height: size,
    backgroundColor: color ?? borderColor(dark),
    marginVertical: spacing,
    marginHorizontal: bleed ? -bleed : 0,
  };

  return <View style={style ? [base, style] : base} />;
}
