/**
 * @file Hook-free React Native Button matching OpenAI ChatKit's Button API (color/variant/style/size plus deprecated back-compat aliases); styling internals live in ./button.styles.
 */

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
  legacyVariantToColor,
  resolveColors,
  SIZES,
  textLabelStyle,
  type ButtonColor,
  type ButtonControlVariant,
  type ButtonSize,
  type ButtonVariant,
} from './button.styles';

export type {
  ButtonColor,
  ButtonControlVariant,
  ButtonSize,
  ButtonVariant,
} from './button.styles';

/**
 * Legacy colour-name variant values - distinguished from ChatKit control
 *  variants so an overloaded `variant` prop routes to the right model. Note
 *  `ghost` is the one value common to both; it is treated as the ChatKit ghost
 *  treatment over the current `color` (default primary), which matches the
 *  legacy ghost look.
 */
const LEGACY_VARIANTS = new Set<ButtonVariant>(['primary', 'secondary', 'danger']);

/**
 * App-wide default corner radius for all buttons. Mutable module-level
 *  state (framework-free, like the tint props pattern) so the app can wire the
 *  persisted `radius` design token here once and have EVERY button follow it
 *  without threading a prop through 20+ call sites. `pill` icon buttons follow
 *  it too. Default 999 keeps the original fully-rounded/circular look.
 */
let defaultButtonRadius = 999;
/** Set the app-wide default corner radius applied to every button. */
export function setDefaultButtonRadius(r: number): void {
  if (Number.isFinite(r) && r >= 0) defaultButtonRadius = r;
}
/** Return the current app-wide default button corner radius. */
export function getDefaultButtonRadius(): number {
  return defaultButtonRadius;
}

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  /** ChatKit semantic colour. Default `primary`. */
  color?: ButtonColor;
  /** ChatKit control variant (visual treatment). Default `solid`. Also accepts the legacy colour-name values (primary/secondary/ghost/danger) for back-compat, which are mapped onto `color` + treatment. */
  variant?: ButtonControlVariant | ButtonVariant;
  /** ChatKit `style` sugar (primary/secondary). Sets `color` when `color` is not explicitly provided. */
  style?: ViewStyle;
  /** ChatKit Button.style: convenience colour shorthand. */
  styleColor?: 'primary' | 'secondary';
  /** ChatKit control size (3xs..3xl). Default `md`. */
  size?: ButtonSize;
  /** Text label. Ignored if `children` is provided. */
  label?: string;
  children?: ReactNode;
  disabled?: boolean;
  /** Shows a spinner and blocks press. */
  loading?: boolean;
  /** ChatKit `block`: stretch to the container width. */
  block?: boolean;
  /** @deprecated Alias of `block`. */
  fullWidth?: boolean;
  /** Square icon-only button: square aspect (width = height for the size), centered icon, no horizontal padding. ChatKit `pill` + `uniform`. */
  pill?: boolean;
  /** ChatKit `uniform`: equal padding so the button is square for its size. */
  uniform?: boolean;
  /** ChatKit `iconStart`: node rendered before the label. */
  iconStart?: ReactNode;
  /** ChatKit `iconEnd`: node rendered after the label. */
  iconEnd?: ReactNode;
  /** @deprecated Alias of `iconStart`. */
  icon?: ReactNode;
  /** @deprecated Alias of `iconEnd`. */
  iconRight?: ReactNode;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Override the resting background - pass a live palette token (e.g. the `primary` token) so the color editor re-themes the button. Falls back to the resolved colour default when omitted. */
  tintBg?: string;
  /** Override the label/icon colour - pass the contrasting palette token (e.g. `bg`) so it tracks `tintBg`. Falls back to the resolved colour default. */
  tintFg?: string;
  /** Corner radius for the button (including `pill`). Falls back to the app-wide default set via `setDefaultButtonRadius` (the persisted `radius` token). */
  radius?: number;
  /** Escape-hatch style merged onto the label last. */
  textStyle?: TextStyle;
}

/** Resolve the canonical `color` + ChatKit `variant` from the (possibly overloaded / legacy) props. */
function resolveModel(
  color: ButtonColor | undefined,
  variant: ButtonControlVariant | ButtonVariant | undefined,
  styleColor: 'primary' | 'secondary' | undefined,
): { color: ButtonColor; variant: ButtonControlVariant } {
  // Legacy colour-name variant (primary/secondary/danger) takes the legacy path.
  if (variant && LEGACY_VARIANTS.has(variant as ButtonVariant) && !color) {
    return legacyVariantToColor(variant as ButtonVariant);
  }
  const baseColor: ButtonColor = color ?? styleColor ?? 'primary';
  const treatment: ButtonControlVariant =
    variant && (['solid', 'soft', 'outline', 'ghost'] as string[]).includes(variant)
      ? (variant as ButtonControlVariant)
      : 'solid';
  return { color: baseColor, variant: treatment };
}

/** Resolved colour set with tint overrides applied. */
type ResolvedColors = ReturnType<typeof resolveColors>;

/** Inputs to the Pressable container style callback. */
interface ContainerStyleArgs {
  spec: (typeof SIZES)[ButtonSize];
  square: boolean;
  stretch: boolean;
  radius: number | undefined;
  c: ResolvedColors;
  isDisabled: boolean;
  style: ViewStyle | undefined;
}

/** Pick the resting/pressed background colour for the container. */
function pickBackground(c: ResolvedColors, usePressedBg: boolean): string {
  if (usePressedBg && c.pressedBg) return c.pressedBg;
  if (usePressedBg && c.ghostPressedBg) return c.ghostPressedBg;
  return c.bg;
}

/** Compute the container opacity for resting/pressed/disabled states. */
function pickOpacity(c: ResolvedColors, usePressedBg: boolean, isDisabled: boolean): number {
  if (isDisabled) return 0.4;
  if (usePressedBg && !c.pressedBg && !c.ghostPressedBg) return 0.85;
  return 1;
}

/** Build the Pressable container style for a given pressed state. */
function containerStyle(
  args: ContainerStyleArgs,
  pressed: boolean,
): (ViewStyle | undefined)[] {
  const { spec, square, stretch, radius, c, isDisabled, style } = args;
  const usePressedBg = pressed && !isDisabled;
  const base: ViewStyle = {
    height: spec.height,
    // square (`pill`/`uniform`) = icon-only: square aspect, no h-padding.
    width: square ? spec.height : stretch ? '100%' : undefined,
    paddingHorizontal: square ? 0 : spec.paddingHorizontal,
    // All buttons follow the explicit `radius` prop, else the app-wide
    // token default (setDefaultButtonRadius). At 999 a square button stays
    // a full circle; lower the token and it becomes a rounded-square.
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

/** Render the button label from `children` or `label`. */
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

/** Tint inputs for the memoised colour resolver. */
interface TintArgs {
  color: ButtonColor | undefined;
  variant: ButtonControlVariant | ButtonVariant | undefined;
  styleColor: 'primary' | 'secondary' | undefined;
  dark: boolean;
  tintBg: string | undefined;
  tintFg: string | undefined;
}

/** Resolve the tint-merged colour set, memoised on its inputs. */
function useResolvedColors(t: TintArgs): ResolvedColors {
  return useMemo(() => {
    const model = resolveModel(t.color, t.variant, t.styleColor);
    const base = resolveColors(model.color, model.variant, t.dark);
    return { ...base, bg: t.tintBg ?? base.bg, text: t.tintFg ?? base.text };
  }, [t.color, t.variant, t.styleColor, t.dark, t.tintBg, t.tintFg]);
}

/** Logical-or of two optional boolean flags (legacy alias semantics). */
function orFlag(a: boolean | undefined, b: boolean | undefined): boolean {
  return a === true || b === true;
}

/** OpenAI ChatKit-API RN button. Accessible (role=button, busy/disabled state). */
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
  const c = useResolvedColors({ color, variant, styleColor, dark, tintBg, tintFg });
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
