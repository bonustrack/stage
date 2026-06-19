/**
 * @file React Native Box/Row/Col layout primitives that drive style through the shared `./layout` prop->style mapper (numbers are px); Box defaults to a column, Row/Col lock direction.
 */

import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  boxStyleEntries,
  type Align,
  type BoxBaseProps,
  type Justify,
} from './layout';
import { isColorToken, resolveColorToken } from './tokens';
import { useKitPalette, useKitScheme, type KitPalette } from './theme-context';

export type { Align, Justify };

/**
 * Semantic surface variant - resolved from the theme palette.
 *    none    transparent (default - most Box)
 *    surface palette `bg`
 *    raised  palette `inputBg` (cards / inputs / sheets / dropdowns)
 *    sunken  palette `bg`      (pressed / well - recessed under a raised surface)
 *    toolbar palette `toolbarBg`
 */
export type Surface = 'none' | 'surface' | 'raised' | 'sunken' | 'toolbar';

export type BoxProps = ViewProps &
  BoxBaseProps & {
    /** Semantic surface variant - resolves a background from the theme palette. Default `none` (transparent). A `background` override wins over it. */
    surface?: Surface;
  };

/** Resolve a surface variant to a palette background. `none` -> undefined. */
function surfaceColor(surface: Surface, palette: KitPalette): string | undefined {
  switch (surface) {
    case 'surface':
      return palette.bg;
    case 'raised':
      return palette.inputBg;
    case 'sunken':
      // No dedicated pressed/well token in the app palette; the recessed look
      // reads as the base bg sitting under a raised surface.
      return palette.bg;
    case 'toolbar':
      return palette.toolbarBg;
    default:
      return undefined;
  }
}

/** Flexbox layout primitive that maps shorthand spacing/alignment props to a React Native View style. */
export function Box({
  direction,
  gap,
  padding,
  margin,
  align,
  justify,
  flex,
  wrap,
  background,
  surface = 'none',
  radius,
  width,
  height,
  size,
  minWidth,
  minHeight,
  maxWidth,
  maxHeight,
  aspectRatio,
  style,
  children,
  ...rest
}: BoxProps) {
  const palette = useKitPalette();
  const scheme = useKitScheme();

  // Precedence: explicit `background` override > semantic `surface` variant.
  // A semantic ColorToken background resolves scheme-aware here (the pure mapper
  // has no scheme); kit `colors` keys + raw strings are resolved in the mapper.
  const override =
    background !== undefined && isColorToken(background)
      ? resolveColorToken(background, scheme)
      : background;
  const bg = override ?? surfaceColor(surface, palette);

  const computed = boxStyleEntries({
    direction,
    gap,
    padding,
    margin,
    align,
    justify,
    flex,
    wrap,
    background: bg,
    radius,
    width,
    height,
    size,
    minWidth,
    minHeight,
    maxWidth,
    maxHeight,
    aspectRatio,
  }) as ViewStyle;

  return (
    <View style={[computed, style]} {...rest}>
      {children}
    </View>
  );
}

export type RowColProps = Omit<BoxProps, 'direction'>;

/** Box variant locked to a horizontal (row) layout. */
export function Row(props: RowColProps) {
  return <Box direction="row" {...props} />;
}

/** Box variant locked to a vertical (column) layout. */
export function Col(props: RowColProps) {
  return <Box direction="col" {...props} />;
}
