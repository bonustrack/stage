/** Input - a ChatKit-styled single-line text field. Mirrors ChatKit's `Input`
 *  widget. Faithful prop names: `name`, `defaultValue`, `placeholder`,
 *  `variant` ('soft' | 'outline'), `size` (ControlSize), `pill`, `disabled`,
 *  `inputType`, `autoFocus`, `autoSelect`, `required`, `pattern`. Deviations
 *  (kit is interactive RN, not server-streamed): ChatKit form controls are
 *  uncontrolled and submitted via a server action; here we also accept a
 *  controlled `value` + `onChangeText`/`onSubmit` callbacks so the app can drive
 *  the field. `dark` boolean keeps the kit hook-free. Wraps RN `TextInput` so
 *  every text-field call site can migrate behind one primitive. `inputType` maps
 *  onto RN keyboardType + secureTextEntry. */

import { useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type KeyboardTypeOptions,
  type ViewStyle,
} from 'react-native';
import {
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  type ControlSize,
  type ControlVariant,
} from './control.styles';
import { BLOCK_RADIUS_DEFAULT } from './tokens';

/** ChatKit Input.inputType. */
export type InputType = 'text' | 'email' | 'password' | 'number' | 'tel' | 'url';

const KEYBOARD: Record<InputType, KeyboardTypeOptions> = {
  text: 'default',
  email: 'email-address',
  password: 'default',
  number: 'numeric',
  tel: 'phone-pad',
  url: 'url',
};

export interface InputProps {
  /** ChatKit: name. Form field name (required). */
  name?: string;
  /** ChatKit: defaultValue. Initial text for the uncontrolled field. */
  defaultValue?: string;
  /** Controlled value (kit extension; pair with onChangeText). */
  value?: string;
  /** ChatKit: placeholder. */
  placeholder?: string;
  /** ChatKit: variant. 'soft' (filled) | 'outline'. Default 'soft'. */
  variant?: ControlVariant;
  /** ChatKit: size. ControlSize scale. Default 'md'. */
  size?: ControlSize;
  /** ChatKit: pill. Fully-rounded corners. */
  pill?: boolean;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** ChatKit: inputType. Maps onto RN keyboardType / secureTextEntry. */
  inputType?: InputType;
  /** ChatKit: autoFocus. */
  autoFocus?: boolean;
  /** ChatKit: autoSelect. Select all on focus. */
  autoSelect?: boolean;
  /** ChatKit: required (parity only; validation is app-side). */
  required?: boolean;
  /** ChatKit: pattern (parity only; validation is app-side). */
  pattern?: string;
  /** Corner radius (px). Falls back to the block radius token (or pill). */
  radius?: number;
  /** Called on each keystroke (RN substitute for ChatKit's onChangeAction). */
  onChangeText?: (text: string) => void;
  /** Called on submit/return. */
  onSubmit?: (text: string) => void;
  /** Effective color scheme. Pass useEffectiveColorScheme() === 'dark'. */
  dark?: boolean;
  /** Escape-hatch style merged last onto the box. */
  style?: ViewStyle | ViewStyle[];
  /** Extra RN TextInput props (refs, returnKeyType, etc.). */
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable'
  >;
}

/** ChatKit-style RN single-line input. */
export function Input(props: InputProps): React.ReactElement {
  const {
    name,
    defaultValue,
    value,
    placeholder,
    variant = 'soft',
    size = 'md',
    pill,
    disabled,
    inputType = 'text',
    autoFocus,
    autoSelect,
    radius,
    onChangeText,
    onSubmit,
    dark = false,
    style,
    inputProps,
  } = props;

  const [focused, setFocused] = useState(false);
  const colors = controlColors(variant, dark);
  const corner = radius ?? (pill ? 999 : BLOCK_RADIUS_DEFAULT);
  const box = controlBoxStyle(size, variant, colors, corner, focused);
  const text = controlTextStyle(size, colors);

  return (
    <TextInput
      {...inputProps}
      nativeID={name ? `input-${name}` : undefined}
      accessibilityLabelledBy={name ? `label-${name}` : undefined}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      selectTextOnFocus={autoSelect}
      keyboardType={KEYBOARD[inputType]}
      secureTextEntry={inputType === 'password'}
      onChangeText={onChangeText}
      onSubmitEditing={(e) => onSubmit?.(e.nativeEvent.text)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={[box, text, disabled && { opacity: 0.5 }, ...(style ? (Array.isArray(style) ? style : [style]) : [])]}
    />
  );
}
