
import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import {
  resolveColors,
  resolveModel,
  SIZES,
  textLabelStyle,
  type ButtonColor,
  type ButtonControlVariant,
  type ButtonSize,
  type ButtonVariant,
} from '../button.styles';

export type {
  ButtonColor,
  ButtonControlVariant,
  ButtonSize,
  ButtonVariant,
} from '../button.styles';

let defaultButtonRadius = 999;
export function setDefaultButtonRadius(r: number): void {
  if (Number.isFinite(r) && r >= 0) defaultButtonRadius = r;
}
export function getDefaultButtonRadius(): number {
  return defaultButtonRadius;
}

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  color?: ButtonColor;
  variant?: ButtonControlVariant | ButtonVariant;
  style?: ViewStyle;
  styleColor?: 'primary' | 'secondary';
  size?: ButtonSize;
  label?: string;
  children?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  block?: boolean;
  fullWidth?: boolean;
  pill?: boolean;
  uniform?: boolean;
  iconStart?: ReactNode;
  iconEnd?: ReactNode;
  icon?: ReactNode;
  iconRight?: ReactNode;
  dark?: boolean;
  tintBg?: string;
  tintFg?: string;
  tintPressedBg?: string;
  radius?: number;
  textStyle?: TextStyle;
}

type ResolvedColors = ReturnType<typeof resolveColors>;

interface ContainerStyleArgs {
  spec: (typeof SIZES)[ButtonSize];
  square: boolean;
  stretch: boolean;
  radius: number | undefined;
  c: ResolvedColors;
  isDisabled: boolean;
  style: ViewStyle | undefined;
}

function pickBackground(c: ResolvedColors, usePressedBg: boolean): string {
  if (usePressedBg && c.pressedBg) return c.pressedBg;
  if (usePressedBg && c.ghostPressedBg) return c.ghostPressedBg;
  return c.bg;
}

function pickOpacity(c: ResolvedColors, usePressedBg: boolean, isDisabled: boolean): number {
  if (isDisabled) return 0.4;
  if (usePressedBg && !c.pressedBg && !c.ghostPressedBg) return 0.85;
  return 1;
}

function containerStyle(
  args: ContainerStyleArgs,
  pressed: boolean,
): (ViewStyle | undefined)[] {
  const { spec, square, stretch, radius, c, isDisabled, style } = args;
  const usePressedBg = pressed && !isDisabled;
  const base: ViewStyle = {
    height: spec.height,
    width: square ? spec.height : stretch ? '100%' : undefined,
    paddingHorizontal: square ? 0 : spec.paddingHorizontal,
    borderRadius: radius ?? defaultButtonRadius,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spec.gap,
    backgroundColor: pickBackground(c, usePressedBg),
    borderWidth: c.borderColor ? 1 : 0,
    borderColor: c.borderColor,
    alignSelf: stretch && !square ? 'stretch' : 'flex-start',
    opacity: pickOpacity(c, usePressedBg, isDisabled),
  };
  return [base, style];
}

function renderLabel(
  children: ReactNode,
  label: string | undefined,
  spec: (typeof SIZES)[ButtonSize],
  textColor: string,
  textStyle: TextStyle | undefined,
): ReactNode {
  if (children !== undefined) {
    if (typeof children !== 'string') return children;
    return (
      <Text style={[textLabelStyle(spec, textColor), textStyle]} numberOfLines={1}>
        {children}
      </Text>
    );
  }
  if (label !== undefined) {
    return (
      <Text style={[textLabelStyle(spec, textColor), textStyle]} numberOfLines={1}>
        {label}
      </Text>
    );
  }
  return null;
}

interface TintArgs {
  color: ButtonColor | undefined;
  variant: ButtonControlVariant | ButtonVariant | undefined;
  styleColor: 'primary' | 'secondary' | undefined;
  dark: boolean;
  tintBg: string | undefined;
  tintFg: string | undefined;
  tintPressedBg: string | undefined;
}

function useResolvedColors(t: TintArgs): ResolvedColors {
  return useMemo(() => {
    const model = resolveModel(t.color, t.variant, t.styleColor);
    const base = resolveColors(model.color, model.variant, t.dark);
    return {
      ...base,
      bg: t.tintBg ?? base.bg,
      text: t.tintFg ?? base.text,
      pressedBg: t.tintPressedBg ?? base.pressedBg,
      ghostPressedBg: t.tintPressedBg ?? base.ghostPressedBg,
    };
  }, [t.color, t.variant, t.styleColor, t.dark, t.tintBg, t.tintFg, t.tintPressedBg]);
}

function orFlag(a: boolean | undefined, b: boolean | undefined): boolean {
  return a === true || b === true;
}

export function Button(props: ButtonProps): React.ReactElement {
  const {
    color,
    variant,
    styleColor,
    block,
    fullWidth,
    pill,
    uniform,
    dark = false,
    tintBg,
    tintFg,
    tintPressedBg,
    size = 'md',
    label,
    children,
    disabled = false,
    loading = false,
    iconStart,
    iconEnd,
    icon,
    iconRight,
    radius,
    style,
    textStyle,
    ...rest
  } = props;

  const startIcon = iconStart ?? icon;
  const endIcon = iconEnd ?? iconRight;
  const stretch = orFlag(block, fullWidth);
  const square = orFlag(pill, uniform);

  const spec = SIZES[size];
  const c = useResolvedColors({ color, variant, styleColor, dark, tintBg, tintFg, tintPressedBg });
  const isDisabled = disabled || loading;

  const labelNode = renderLabel(children, label, spec, c.text, textStyle);
  const styleArgs: ContainerStyleArgs = { spec, square, stretch, radius, c, isDisabled, style };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      style={({ pressed }: { pressed: boolean }) => containerStyle(styleArgs, pressed)}
      {...rest}
    >
      {loading ? (
        <ActivityIndicator size={spec.spinner} color={c.text} />
      ) : (
        <>
          {startIcon}
          {labelNode}
          {endIcon}
        </>
      )}
    </Pressable>
  );
}
