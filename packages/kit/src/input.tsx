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

import { forwardRef, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
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
  /** Override the placeholder colour (else derived from variant/scheme). */
  placeholderTextColor?: string;
  /** Escape-hatch style merged last onto the box (accepts text + view style). */
  style?: StyleProp<TextStyle>;
  /** Extra RN TextInput props (refs, returnKeyType, selection, etc.). Its
   *  onFocus/onBlur are chained after the kit focus tracking. */
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable'
  >;
}

/** ChatKit-style RN single-line input. Forwards a ref to the underlying
 *  RN TextInput so call sites can focus/blur it. */
export const Input = forwardRef<TextInput, InputProps>(function Input(props, ref) {
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
    placeholderTextColor,
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
      ref={ref}
      nativeID={name ? `input-${name}` : undefined}
      accessibilityLabelledBy={name ? `label-${name}` : undefined}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      selectTextOnFocus={autoSelect}
      keyboardType={KEYBOARD[inputType]}
      secureTextEntry={inputType === 'password'}
      onChangeText={onChangeText}
      onSubmitEditing={(e) => {
        onSubmit?.(e.nativeEvent.text);
        inputProps?.onSubmitEditing?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        inputProps?.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        inputProps?.onBlur?.(e);
      }}
      style={[box, text, disabled && { opacity: 0.5 }, style]}
    />
  );
});
