/** Button — a ChatKit-styled React Native button for the Metro mobile client.
 *
 *  Lives in @metro-labs/kit (alongside layout.ts) but, unlike the pure-data
 *  primitives, this is a real RN component — it imports `react-native` directly,
 *  which is fine because only apps/app (RN) imports `@metro-labs/kit/button`.
 *  react-native is declared as a peerDependency.
 *
 *  Aesthetic (OpenAI ChatKit): clean, restrained, ~10px rounded corners (pill
 *  optional). Variants:
 *    - primary   solid; follows the app convention — dark scheme → white bg /
 *                dark text, light scheme → black bg / white text.
 *    - secondary subtle filled (rowBg fill + border, head text).
 *    - ghost     transparent, head text, faint pressed bg.
 *    - danger    solid red.
 *  Pressed = opacity 0.85 (solid) / faint bg (ghost). Disabled = opacity 0.4.
 *  Loading = ActivityIndicator in the text colour, label dimmed, press disabled.
 *
 *  Theme: the caller passes `dark` (read from the app's useEffectiveColorScheme
 *  / usePalette). The kit stays free of the app's hook so it remains importable
 *  from anywhere; the single boolean keeps colours in lock-step with the palette
 *  convention in apps/app/lib/theme.ts. */

import { useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  type PressableProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

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
  /** Fully-rounded corners. Default is a ~ChatKit 11px radius. */
  pill?: boolean;
  /** Node rendered before the label. */
  icon?: ReactNode;
  /** Node rendered after the label. */
  iconRight?: ReactNode;
  /** Effective color scheme. Pass `useEffectiveColorScheme() === 'dark'`. */
  dark?: boolean;
  /** Escape-hatch style merged onto the container last. */
  style?: ViewStyle;
  /** Escape-hatch style merged onto the label last. */
  textStyle?: TextStyle;
}

interface SizeSpec {
  height: number;
  paddingHorizontal: number;
  fontSize: number;
  gap: number;
  spinner: 'small' | 'large';
}

const SIZES: Record<ButtonSize, SizeSpec> = {
  sm: { height: 32, paddingHorizontal: 12, fontSize: 14, gap: 6, spinner: 'small' },
  md: { height: 40, paddingHorizontal: 16, fontSize: 15, gap: 8, spinner: 'small' },
  lg: { height: 48, paddingHorizontal: 20, fontSize: 16, gap: 8, spinner: 'small' },
};

interface VariantColors {
  /** resting background */
  bg: string;
  /** pressed background (overrides opacity dimming when set) */
  pressedBg?: string;
  text: string;
  borderColor?: string;
  /** faint pressed background for transparent variants */
  ghostPressedBg?: string;
}

const DANGER = '#d6453d';
const DANGER_PRESSED = '#bf3a33';

/** Resolve the colour set for a variant under the given scheme, mirroring the
 *  palette convention in apps/app/lib/theme.ts (head/bg/rowBg/border). */
function variantColors(variant: ButtonVariant, dark: boolean): VariantColors {
  const head = dark ? '#ffffff' : '#000000';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const rowBg = dark ? '#282a2d' : '#e4e4e5';
  const border = dark ? '#282a2d' : '#e4e4e5';
  switch (variant) {
    case 'primary':
      return { bg: head, text: bg };
    case 'secondary':
      return { bg: rowBg, text: head, borderColor: border };
    case 'ghost':
      return {
        bg: 'transparent',
        text: head,
        ghostPressedBg: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      };
    case 'danger':
      return { bg: DANGER, pressedBg: DANGER_PRESSED, text: '#ffffff' };
  }
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
    style,
    textStyle,
    ...rest
  } = props;

  const spec = SIZES[size];
  const c = useMemo(() => variantColors(variant, dark), [variant, dark]);
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
          paddingHorizontal: spec.paddingHorizontal,
          borderRadius: pill ? 999 : 11,
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
          alignSelf: fullWidth ? 'stretch' : 'flex-start',
          width: fullWidth ? '100%' : undefined,
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

function textLabelStyle(spec: SizeSpec, color: string): TextStyle {
  return {
    color,
    fontSize: spec.fontSize,
    fontFamily: 'Calibre-Semibold',
    textAlign: 'center',
  };
}
