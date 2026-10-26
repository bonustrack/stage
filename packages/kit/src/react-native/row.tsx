import { View, type ViewProps, type ViewStyle } from 'react-native';
import { boxStyleEntries, surfaceColor, type Align, type BoxBaseProps, type Justify, type Surface } from '../layout';
import { resolvePaletteColor } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { useKitPalette } from './theme-context';

export type { Align, Justify, Surface };

export type FlexProps = ViewProps & Omit<BoxBaseProps, 'direction'> & A2uiCommonProps & {
  surface?: Surface;
};

export function Flex({ direction, surface = 'none', background, accessibility, style, children, ...rest }: FlexProps & { direction: 'row' | 'col' }): React.ReactElement {
  const palette = useKitPalette();
  const {
    gap, padding, margin, align, justify, weight, wrap, radius, width, height, size,
    minWidth, minHeight, maxWidth, maxHeight, aspectRatio, border, ...view
  } = rest;
  const override = background === undefined ? undefined : resolvePaletteColor(background, palette);
  const computed = boxStyleEntries({
    direction, gap, padding, margin, align, justify, weight, wrap, radius, width, height, size,
    minWidth, minHeight, maxWidth, maxHeight, aspectRatio, border,
    background: override ?? surfaceColor(surface, palette),
  }) as ViewStyle;
  return (
    <View {...accessibilityProps(accessibility)} {...view} style={[computed, style]}>
      {children}
    </View>
  );
}

export function Row(props: FlexProps): React.ReactElement {
  return <Flex direction="row" {...props} />;
}
