
import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  boxStyleEntries,
  surfaceColor,
  type Align,
  type BoxBaseProps,
  type Justify,
  type Surface,
} from '../layout';
import { isColorToken, resolveColorToken } from '../tokens';
import { useKitPalette, useKitScheme } from './theme-context';

export type { Align, Justify };

export type { Surface };

export type BoxProps = ViewProps &
  BoxBaseProps & {
    surface?: Surface;
  };

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
  border,
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
    border,
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
