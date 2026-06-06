/** Spacer - a ChatKit-styled flexible spacer for the Metro mobile client.
 *
 *  Mirrors OpenAI ChatKit's `Spacer` widget node (WidgetNode). Real ChatKit
 *  prop kept verbatim: `minSize`. No `dark` deviation (a spacer draws nothing).
 *
 *  Behaviour: a flexible gap that grows to fill the free space along the
 *  parent's main axis (flex:1 by default), pushing siblings apart - replacing
 *  the app's ad-hoc `<View style={{ flex: 1 }} />` spacer pattern with one named
 *  primitive. `minSize` floors both dimensions so the spacer keeps a minimum
 *  gap even when there is no free space to flex into (e.g. inside a scroll
 *  view). Pass `flex={0}` for a pure fixed `minSize` gap. */

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
