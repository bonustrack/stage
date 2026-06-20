
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

export type Surface = 'none' | 'surface' | 'raised' | 'sunken' | 'toolbar';

export type BoxProps = ViewProps &
  BoxBaseProps & {
    surface?: Surface;
  };

function surfaceColor(surface: Surface, palette: KitPalette): string | undefined {
  switch (surface) {
    case 'surface':
      return palette.bg;
    case 'raised':
      return palette.inputBg;
    case 'sunken':
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

export function Row(props: RowColProps) {
  return <Box direction="row" {...props} />;
}

export function Col(props: RowColProps) {
  return <Box direction="col" {...props} />;
}
