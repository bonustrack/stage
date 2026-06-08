/** Button - a ChatKit-styled RN button. Imports react-native directly (declared
 *  as a peerDependency); fine since only apps/app imports it. Hook-free: caller
 *  passes `dark` so the kit stays importable anywhere while colours track the
 *  palette convention in apps/app/lib/theme.ts. Size specs / variant colours /
 *  label style live in ./button.styles. */

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
  SIZES,
  textLabelStyle,
  variantColors,
  type ButtonSize,
  type ButtonVariant,
} from './button.styles';

export type { ButtonSize, ButtonVariant } from './button.styles';

/** App-wide default corner radius for all buttons. Mutable module-level
 *  state (framework-free, like the tint props pattern) so the app can wire the
 *  persisted `radius` design token here once and have EVERY button follow it
 *  without threading a prop through 20+ call sites. `pill` icon buttons follow
 *  it too. Default 999 keeps the original fully-rounded/circular look. */
let defaultButtonRadius = 999;
export function setDefaultButtonRadius(r: number): void {
  if (Number.isFinite(r) && r >= 0) defaultButtonRadius = r;
}
export function getDefaultButtonRadius(): number { return defaultButtonRadius; }

export interface ButtonProps
  extends Omit<PressableProps, 'children' | 'style' | 'disabled'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Text label. Ignored if `children` is provided. */
  label?: string;
  children?: ReactNode;
  disabled?: boolean;
  /** Shows a spinner and blocks press. */
  loading?: boolean;
  /** Stretch to the container width. */
  fullWidth?: boolean;
  /** Square icon-only button: square aspect (width = height for the size),
   *  centered icon, no horizontal padding. For icon-only usage. Corners follow
   *  the radius token like every button — at the default 999 it's a full circle;
   *  lower the token and it becomes a rounded-square icon button. */
  pill?: boolean;
  /** Node rendered before the label. */
  icon?: ReactNode;
  /** Node rendered after the label. */
  iconRight?: ReactNode;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Override the resting background — pass a live palette token (e.g. the
   *  `primary` token) so the color editor re-themes the button. Falls back to
   *  the variant default when omitted. */
  tintBg?: string;
  /** Override the label/icon colour — pass the contrasting palette token (e.g.
   *  `bg`) so it tracks `tintBg`. Falls back to the variant default. */
  tintFg?: string;
  /** Corner radius for the button (including `pill`). Falls back to the app-wide
   *  default set via `setDefaultButtonRadius` (the persisted `radius` token).
   *  At the default 999 a square `pill` stays a full circle. */
  radius?: number;
  /** Escape-hatch style merged onto the container last. */
  style?: ViewStyle;
  /** Escape-hatch style merged onto the label last. */
  textStyle?: TextStyle;
}

/** ChatKit-style RN button. Accessible (role=button, busy/disabled state). */
export function Button(props: ButtonProps): React.ReactElement {
  const {
    variant = 'primary',
    size = 'md',
    label,
    children,
    disabled = false,
    loading = false,
    fullWidth = false,
    pill = false,
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

  const spec = SIZES[size];
  const c = useMemo(() => {
    const base = variantColors(variant, dark);
    return {
      ...base,
      bg: tintBg ?? base.bg,
      text: tintFg ?? base.text,
    };
  }, [variant, dark, tintBg, tintFg]);
  const isDisabled = disabled || loading;

  const labelNode =
    children !== undefined ? (
      typeof children === 'string' ? (
        <Text
          style={[textLabelStyle(spec, c.text), textStyle]}
          numberOfLines={1}
        >
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
      style={({ pressed }: { pressed: boolean }) => {
        const usePressedBg = pressed && !isDisabled;
        const base: ViewStyle = {
          height: spec.height,
          // `pill` = circular icon-only: square aspect, no horizontal padding.
          width: pill ? spec.height : fullWidth ? '100%' : undefined,
          paddingHorizontal: pill ? 0 : spec.paddingHorizontal,
          // All buttons (including `pill` icon buttons) follow the explicit
          // `radius` prop, else the app-wide token default (setDefaultButtonRadius).
          // At the default 999 a square `pill` button stays a full circle; lower
          // the token and pills become rounded-squares like every other button.
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
          alignSelf: fullWidth && !pill ? 'stretch' : 'flex-start',
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
          {icon}
          {labelNode}
          {iconRight}
        </>
      )}
    </Pressable>
  );
}
