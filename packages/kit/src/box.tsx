/** Box / Row / Col - React Native layout primitives. RELOCATED here from
 *  apps/app/components/layout/Box.tsx so Kit is the single import source
 *  (apps/app now re-exports these). Mirrors ChatKit's `Box`/`Row`/`Col` layout
 *  widgets via the SHARED prop->style mapper in `./layout`, so the RN renderer
 *  and the Vue renderer in apps/ui stay in lock-step. Numbers = px (RN treats
 *  unitless numbers as px). The `style` prop is merged AFTER the computed style
 *  so caller overrides / escape-hatch props (borders, etc.) win.
 *
 *  Box defaults to a column. Row/Col lock `direction` and otherwise accept the
 *  full Box API. */

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

/** Semantic surface variant - resolved from the theme palette.
 *    none    transparent (default - most Box)
 *    surface palette `bg`
 *    raised  palette `inputBg` (cards / inputs / sheets / dropdowns)
 *    sunken  palette `bg`      (pressed / well - recessed under a raised surface)
 *    toolbar palette `toolbarBg` */
export type Surface = 'none' | 'surface' | 'raised' | 'sunken' | 'toolbar';

export type BoxProps = ViewProps &
  BoxBaseProps & {
    /** Semantic surface variant - resolves a background from the theme palette.
     *  Default `none` (transparent). A `background` override wins over it. */
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
  const bg = override !== undefined ? override : surfaceColor(surface, palette);

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

export function Row(props: RowColProps) {
  return <Box direction="row" {...props} />;
}

export function Col(props: RowColProps) {
  return <Box direction="col" {...props} />;
}
