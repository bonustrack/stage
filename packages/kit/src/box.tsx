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
import { boxStyleEntries, type Align, type BoxBaseProps, type Justify } from './layout';

export type { Align, Justify };

export type BoxProps = ViewProps & BoxBaseProps;

export function Box({
  direction,
  gap,
  padding,
  margin,
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
    margin,
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
