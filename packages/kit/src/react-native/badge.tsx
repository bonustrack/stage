import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { resolveBadgeStyle, type BadgeColor, type BadgeColorValue, type BadgeSize, type BadgeVariant } from '../badge';
import type { ResolvedBoxBorder } from '../layout';
import type { TextSizeToken, TextWeight } from '../text.styles';
import { FONT_SIZE } from '../tokens';
import { accessibilityProps, type A2uiCommonProps } from './a2ui-props';
import { Row } from './row';
import { Text } from './text';
import { useKitScheme } from './theme-context';

export type { BadgeColor, BadgeColorValue, BadgeSize, BadgeVariant };

export interface BadgeTextProps {
  fontWeight: TextWeight;
  color: string;
  style: TextStyle;
}

export interface BadgeProps extends A2uiCommonProps {
  label: string;
  color?: BadgeColorValue;
  background?: BadgeColorValue;
  variant?: BadgeVariant;
  size?: BadgeSize;
  pill?: boolean;
  dark?: boolean;
  textSize?: TextSizeToken;
  fontWeight?: TextWeight;
  truncate?: boolean;
  children?: ReactNode | ((text: BadgeTextProps) => ReactNode);
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
}

const PAD_X: Record<BadgeSize, number> = { '3xs': 5, '2xs': 6, sm: 8, md: 10, lg: 12 };

const PAD_Y: Record<BadgeSize, number> = { '3xs': 1, '2xs': 1, sm: 2, md: 3, lg: 4 };

function outlineBorder(color: string | undefined): ResolvedBoxBorder | undefined {
  if (color === undefined) return undefined;
  const side = { width: 1, color };
  return { top: side, right: side, bottom: side, left: side };
}

export function Badge({
  label,
  color,
  background,
  variant,
  size = 'sm',
  pill = true,
  dark,
  textSize,
  fontWeight = 'semibold',
  truncate,
  children,
  style,
  textStyle,
  weight,
  accessibility,
}: BadgeProps): React.ReactElement {
  const scheme = useKitScheme();
  const styled = resolveBadgeStyle(color, background, size, dark === undefined ? scheme : dark ? 'dark' : 'light', variant);
  const text: BadgeTextProps = {
    fontWeight,
    color: styled.foreground,
    style: { fontSize: textSize === undefined ? styled.fontSize : FONT_SIZE[textSize], ...textStyle },
  };
  return (
    <Row
      {...accessibilityProps(accessibility)}
      align="center"
      weight={weight}
      padding={{ x: PAD_X[size], y: PAD_Y[size] }}
      radius={pill ? 'full' : 'sm'}
      background={styled.background}
      border={outlineBorder(styled.borderColor)}
      style={style}
    >
      {typeof children === 'function' ? children(text) : (children ?? <Text text={label} truncate={truncate} {...text} />)}
    </Row>
  );
}
