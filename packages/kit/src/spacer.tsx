/** Spacer - a ChatKit-styled flexible spacer. Mirrors ChatKit's `Spacer`
 *  widget. A gap that grows to fill free space on the parent's main axis (flex:1
 *  default), pushing siblings apart. `minSize` floors both dimensions so it
 *  keeps a minimum gap when there is no free space to flex into (e.g. in a
 *  scroll view); pass `flex={0}` for a pure fixed `minSize` gap. */

import { View, type ViewStyle, type DimensionValue } from 'react-native';

export interface SpacerProps {
  /** ChatKit: minSize. Minimum gap (px) along both axes. Default 0. */
  minSize?: number | string;
  /** Flex grow factor. Default 1 (fills free space). Pass 0 for a fixed gap. */
  flex?: number;
  /** Escape-hatch style merged last. */
  style?: ViewStyle;
}

/** ChatKit-style RN flexible spacer. */
export function Spacer(props: SpacerProps): React.ReactElement {
  const { minSize, flex = 1, style } = props;

  const base: ViewStyle = {
    flex,
    minWidth: minSize as DimensionValue | undefined,
    minHeight: minSize as DimensionValue | undefined,
  };

  return <View style={style ? [base, style] : base} />;
}
