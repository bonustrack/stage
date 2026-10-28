import { useState } from 'react';
import { Pressable, View, type ViewProps, type ViewStyle } from 'react-native';
import { boxStyleEntries, surfaceColor, type Align, type BoxBaseProps, type Justify, type Surface } from '../layout';
import { resolvePaletteColor } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { useKitPalette } from './theme-context';

export type { Align, Justify, Surface };

export type FlexProps = ViewProps & Omit<BoxBaseProps, 'direction'> & A2uiCommonProps & {
  surface?: Surface;
  onPress?: () => void;
  disabled?: boolean;
};

const HOVERED: ViewStyle = { opacity: 0.85 };
const PRESSED: ViewStyle = { opacity: 0.7 };

function PressableFlex({ style, onPress, disabled, accessibility, children, ...view }: ViewProps & Pick<FlexProps, 'onPress' | 'disabled' | 'accessibility'>): React.ReactElement {
  const [hovered, setHovered] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      {...accessibilityProps(accessibility)}
      {...view}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => { setHovered(true); }}
      onHoverOut={() => { setHovered(false); }}
      style={({ pressed }) => [style, pressed ? PRESSED : hovered ? HOVERED : null]}
    >
      {children}
    </Pressable>
  );
}

export function Flex({ direction, surface = 'none', background, accessibility, style, onPress, disabled, children, ...rest }: FlexProps & { direction: 'row' | 'col' }): React.ReactElement {
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
  if (onPress !== undefined) {
    return <PressableFlex {...view} accessibility={accessibility} onPress={onPress} disabled={disabled} style={[computed, style]}>{children}</PressableFlex>;
  }
  return (
    <View {...accessibilityProps(accessibility)} {...view} style={[computed, style]}>
      {children}
    </View>
  );
}

export function Row(props: FlexProps): React.ReactElement {
  return <Flex direction="row" {...props} />;
}
