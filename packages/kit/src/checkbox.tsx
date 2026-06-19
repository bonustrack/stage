/** Checkbox - a ChatKit-styled checkbox. Mirrors ChatKit's `Checkbox` widget.
 *  Faithful prop names: `name`, `label`, `defaultChecked`, `disabled`,
 *  `required`. Deviation (kit is interactive RN, not server-streamed): ChatKit's
 *  `onChangeAction` (a server ActionConfig) is replaced by an `onChange(checked)`
 *  callback, and a controlled `checked` prop is accepted so the app can drive it.
 *  `dark` boolean keeps the kit hook-free. The box is drawn with RN views + the
 *  shared Kit `check` heroicon glyph. */

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

  const head = dark ? '#ffffff' : '#000000';
  const bg = dark ? '#0e0f10' : '#ffffff';
  const border = dark ? '#282a2d' : '#e4e4e5';

  /** Toggle helper. */
  function toggle(): void {
    if (disabled) return;
    const next = !checked;
    if (controlled === undefined) setInternal(next);
    onChange?.(next);
  }

  const box: ViewStyle = {
    width: size,
    height: size,
    borderRadius: 6,
    borderWidth: checked ? 0 : 1,
    borderColor: border,
    backgroundColor: checked ? head : bg,
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={label ?? name}
      disabled={disabled}
      onPress={toggle}
      style={[
        { flexDirection: 'row', alignItems: 'center', gap: 10, opacity: disabled ? 0.5 : 1 },
        ...(style ? (Array.isArray(style) ? style : [style]) : []),
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
