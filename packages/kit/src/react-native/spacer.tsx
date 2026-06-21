
import { View, type ViewStyle, type DimensionValue } from 'react-native';

export interface SpacerProps {
  minSize?: number | string;
  flex?: number;
  style?: ViewStyle;
}

export function Spacer(props: SpacerProps): React.ReactElement {
  const { minSize, flex = 1, style } = props;

  const base: ViewStyle = {
    flex,
    minWidth: minSize as DimensionValue | undefined,
    minHeight: minSize as DimensionValue | undefined,
  };

  return <View style={style ? [base, style] : base} />;
}
