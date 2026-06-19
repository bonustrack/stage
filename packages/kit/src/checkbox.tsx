/**
 * @file Checkbox — a hook-free interactive ChatKit-styled checkbox (controlled `checked` + `onChange` instead of ChatKit's server action), drawn with RN views and the shared `check` heroicon glyph.
 */

import { useState } from 'react';
import { Pressable, View, Text as RNText, type ViewStyle } from 'react-native';
import { Icon } from './icon';

export interface CheckboxProps {
  /** ChatKit: name. Form field name. */
  name?: string;
  /** ChatKit: label. Text shown beside the box. */
  label?: string;
  /** ChatKit: defaultChecked. Initial state for the uncontrolled checkbox. */
  defaultChecked?: boolean;
  /** Controlled checked state (kit extension; pair with onChange). */
  checked?: boolean;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** ChatKit: required (parity only; validation is app-side). */
  required?: boolean;
  /** RN substitute for ChatKit's onChangeAction. */
  onChange?: (checked: boolean) => void;
  /** Box size (px). Default 20. */
  size?: number;
  /** Effective color scheme. */
  dark?: boolean;
  /** Escape-hatch style merged onto the row. */
  style?: ViewStyle | ViewStyle[];
}

/** Normalise the escape-hatch style prop to a flat array. */
function styleList(style: ViewStyle | ViewStyle[] | undefined): ViewStyle[] {
  if (!style) return [];
  return Array.isArray(style) ? style : [style];
}

/** Resolve the checkbox colour set for the active scheme. */
function checkboxColors(dark: boolean): { head: string; bg: string; border: string } {
  return {
    head: dark ? '#ffffff' : '#000000',
    bg: dark ? '#0e0f10' : '#ffffff',
    border: dark ? '#282a2d' : '#e4e4e5',
  };
}

/** Build the box style for the given checked/size/colour state. */
function boxStyle(
  size: number,
  checked: boolean,
  colors: { head: string; bg: string; border: string },
): ViewStyle {
  return {
    width: size,
    height: size,
    borderRadius: 6,
    borderWidth: checked ? 0 : 1,
    borderColor: colors.border,
    backgroundColor: checked ? colors.head : colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  };
}

/** ChatKit-style RN checkbox. */
export function Checkbox(props: CheckboxProps): React.ReactElement {
  const {
    name,
    label,
    defaultChecked,
    checked: controlled,
    disabled,
    onChange,
    size = 20,
    dark = false,
    style,
  } = props;

  const [internal, setInternal] = useState(defaultChecked ?? false);
  const checked = controlled ?? internal;

  const { head, bg } = checkboxColors(dark);

  /** Toggle helper. */
  function toggle(): void {
    if (disabled) return;
    const next = !checked;
    if (controlled === undefined) setInternal(next);
    onChange?.(next);
  }

  const box = boxStyle(size, checked, checkboxColors(dark));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label ?? name}
      disabled={disabled}
      onPress={toggle}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 },
        ...styleList(style),
      ]}
    >
      <View style={box}>
        {checked ? <Icon name="check" size={size - 4} color={bg} /> : null}
      </View>
      {label ? (
        <RNText style={{ color: head, fontSize: 15, fontFamily: 'Calibre-Medium' }}>{label}</RNText>
      ) : null}
    </Pressable>
  );
}
