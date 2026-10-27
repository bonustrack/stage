import { useMemo, type ReactNode } from 'react';
import { Pressable, Text, type PressableProps, type TextStyle, type ViewStyle } from 'react-native';
import {
  resolveButtonVariant, resolveColors, SIZES, textLabelStyle, type ButtonColor, type ButtonSize, type ButtonVariant, type SizeSpec,
} from '../button.styles';
import type { ValidationResult } from '../a2ui/protocol';
import { accessibilityProps, failingChecks, weightStyle, type A2uiCommonProps } from './a2ui-props';
import { ContentColorProvider } from './content-color';
import { Spinner } from './spinner';
import { useKitScheme } from './theme-context';

export type { ButtonColor, ButtonControlVariant, ButtonHint, ButtonSize, ButtonVariant } from '../button.styles';

const SPINNER_SIZE: Record<SizeSpec['spinner'], number> = { small: 20, large: 36 };

let defaultButtonRadius = 999;
export function setDefaultButtonRadius(r: number): void {
  if (Number.isFinite(r) && r >= 0) defaultButtonRadius = r;
}
export function getDefaultButtonRadius(): number {
  return defaultButtonRadius;
}

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'disabled'>, A2uiCommonProps {
  color?: ButtonColor;
  variant?: ButtonVariant;
  checks?: readonly ValidationResult[];
  style?: ViewStyle;
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
  link: boolean;
  style: ViewStyle | undefined;
}

const LINK: ViewStyle = { height: undefined, width: undefined, paddingHorizontal: 0, backgroundColor: 'transparent', borderWidth: 0 };
const LINK_PRESSED: ViewStyle = { ...LINK, opacity: 0.7 };

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
  const { spec, square, stretch, radius, c, isDisabled, link, style } = args;
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
  return [base, linkStyle(link, usePressedBg), style];
}

function linkStyle(link: boolean, pressed: boolean): ViewStyle | undefined {
  if (!link) return undefined;
  return pressed ? LINK_PRESSED : LINK;
}

function renderLabel(
  children: ReactNode,
  label: string | undefined,
  spec: (typeof SIZES)[ButtonSize],
  textColor: string,
  textStyle: TextStyle | undefined,
): ReactNode {
  const content = children !== undefined ? children : label;
  if (content === undefined) return null;
  if (typeof content !== 'string') return content;
  return (
    <Text style={[textLabelStyle(spec, textColor), textStyle]} numberOfLines={1}>
      {content}
    </Text>
  );
}

type TintArgs = Pick<ButtonProps, 'color' | 'variant' | 'tintBg' | 'tintFg' | 'tintPressedBg'> & { dark: boolean };

function useResolvedColors(t: TintArgs): ResolvedColors {
  return useMemo(() => {
    const resolved = resolveButtonVariant(t.variant, t.color);
    const base = resolveColors(resolved.color, resolved.fill, t.dark);
    return {
      ...base,
      bg: t.tintBg ?? base.bg,
      text: t.tintFg ?? base.text,
      pressedBg: t.tintPressedBg ?? base.pressedBg,
      ghostPressedBg: t.tintPressedBg ?? base.ghostPressedBg,
    };
  }, [t.color, t.variant, t.dark, t.tintBg, t.tintFg, t.tintPressedBg]);
}

type ContainerInput = Pick<ContainerStyleArgs, 'spec' | 'c' | 'isDisabled'>
  & Pick<ButtonProps, 'variant' | 'block' | 'fullWidth' | 'uniform' | 'pill' | 'radius' | 'weight' | 'style'>;

function containerArgs(input: ContainerInput): ContainerStyleArgs {
  const { spec, c, isDisabled, variant, block, fullWidth, uniform, pill, radius, weight, style } = input;
  return {
    link: variant === 'borderless',
    spec,
    square: uniform === true,
    stretch: block === true || fullWidth === true,
    radius: pill === true ? 999 : radius,
    c,
    isDisabled,
    style: weight === undefined ? style : { ...weightStyle(weight), ...style },
  };
}

export function Button(props: ButtonProps): React.ReactElement {
  const scheme = useKitScheme();
  const {
    color,
    variant,
    checks,
    weight,
    accessibility,
    block,
    fullWidth,
    pill,
    uniform,
    dark = scheme === 'dark',
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
  const spec = SIZES[size];
  const c = useResolvedColors({ color, variant, dark, tintBg, tintFg, tintPressedBg });
  const isDisabled = disabled || loading || failingChecks(checks);
  const labelNode = renderLabel(children, label, spec, c.text, textStyle);
  const styleArgs = containerArgs({ spec, c, isDisabled, variant, block, fullWidth, uniform, pill, radius, weight, style });

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      {...accessibilityProps(accessibility)}
      disabled={isDisabled}
      style={({ pressed }: { pressed: boolean }) => containerStyle(styleArgs, pressed)}
      {...rest}
    >
      {loading ? (
        <Spinner size={SPINNER_SIZE[spec.spinner]} color={c.text} />
      ) : (
        <ContentColorProvider color={c.text}>
          {startIcon}
          {labelNode}
          {endIcon}
        </ContentColorProvider>
      )}
    </Pressable>
  );
}
