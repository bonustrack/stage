/** Box / Row / Col — React Native layout primitives.
 *
 *  These render a single <View> whose style is computed from the SHARED
 *  prop->style mapper in @metro-labs/kit/layout, so the prop API stays in
 *  lock-step with the Vue primitives in apps/ui. Numbers = px (RN treats
 *  unitless numbers as px). The `style` prop is merged AFTER the computed
 *  style so caller overrides / escape-hatch props (borders, etc.) win.
 *
 *  Box defaults to a column. Row/Col lock `direction` and otherwise accept the
 *  full Box API. */

import { View, type ViewProps, type ViewStyle } from 'react-native';
import {
  boxStyleEntries,
  type Align,
  type BoxBaseProps,
  type Justify,
} from '@metro-labs/kit/layout';

export type { Align, Justify };

export type BoxProps = ViewProps & BoxBaseProps;

export function Box({
  direction,
  gap,
  padding,
  p,
  px,
  py,
  pt,
  pr,
  pb,
  pl,
  margin,
  m,
  mx,
  my,
  mt,
  mr,
  mb,
  ml,
  align,
  justify,
  flex,
  wrap,
  bg,
  radius,
  style,
  children,
  ...rest
}: BoxProps) {
  const computed = boxStyleEntries({
    direction,
    gap,
    padding,
    p,
    px,
    py,
    pt,
    pr,
    pb,
    pl,
    margin,
    m,
    mx,
    my,
    mt,
    mr,
    mb,
    ml,
    align,
    justify,
    flex,
    wrap,
    bg,
    radius,
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
