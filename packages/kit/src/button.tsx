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

/** OpenAI ChatKit-API RN button. Accessible (role=button, busy/disabled state). */
// eslint-disable-next-line complexity, max-lines-per-function -- TODO(chaitu): refactor to satisfy function-size limits
export function Button(props: ButtonProps): React.ReactElement {
  const {
    color,
    variant,
    styleColor,
    size = 'md',
    label,
    children,
    disabled = false,
    loading = false,
    block = false,
    fullWidth = false,
    pill = false,
    uniform = false,
    iconStart,
    iconEnd,
    icon,
    iconRight,
    dark = false,
    tintBg,
    tintFg,
    radius,
    style,
    textStyle,
    ...rest
  } = props;

  const startIcon = iconStart ?? icon;
  const endIcon = iconEnd ?? iconRight;
  const stretch = block || fullWidth;
  const square = pill || uniform;

  const spec = SIZES[size];
  const c = useMemo(() => {
    const model = resolveModel(color, variant, styleColor);
    const base = resolveColors(model.color, model.variant, dark);
    return {
      ...base,
      bg: tintBg ?? base.bg,
      text: tintFg ?? base.text,
    };
  }, [color, variant, styleColor, dark, tintBg, tintFg]);
  const isDisabled = disabled || loading;

  const labelNode =
    children !== undefined ? (
      typeof children === 'string' ? (
        <Text style={[textLabelStyle(spec, c.text), textStyle]} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )
    ) : label !== undefined ? (
      <Text style={[textLabelStyle(spec, c.text), textStyle]} numberOfLines={1}>
        {label}
      </Text>
    ) : null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      // eslint-disable-next-line complexity -- TODO(chaitu): refactor to satisfy function-size limits
      style={({ pressed }: { pressed: boolean }) => {
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
          backgroundColor:
            usePressedBg && c.pressedBg
              ? c.pressedBg
              : usePressedBg && c.ghostPressedBg
                ? c.ghostPressedBg
                : c.bg,
          borderWidth: c.borderColor ? 1 : 0,
          borderColor: c.borderColor,
          alignSelf: stretch && !square ? 'stretch' : 'flex-start',
          opacity: isDisabled
            ? 0.4
            : usePressedBg && !c.pressedBg && !c.ghostPressedBg
              ? 0.85
              : 1,
        };
        return [base, style];
      }}
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
