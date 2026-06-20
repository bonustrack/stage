
import { forwardRef, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type KeyboardTypeOptions,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type FocusEv = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
import {
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  type ControlSize,
  type ControlVariant,
} from './control.styles';
import { BLOCK_RADIUS_DEFAULT } from './tokens';

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
  name?: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  pill?: boolean;
  disabled?: boolean;
  inputType?: InputType;
  autoFocus?: boolean;
  autoSelect?: boolean;
  required?: boolean;
  pattern?: string;
  radius?: number;
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  dark?: boolean;
  placeholderTextColor?: string;
  style?: StyleProp<TextStyle>;
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable'
  >;
}

function fieldIds(name: string | undefined): { nativeID?: string; accessibilityLabelledBy?: string } {
  if (!name) return {};
  return { nativeID: `input-${name}`, accessibilityLabelledBy: `label-${name}` };
}

function chainFocus(
  focused: boolean,
  setFocused: (v: boolean) => void,
  next: ((e: FocusEv) => void) | undefined,
  e: FocusEv,
): void {
  setFocused(focused);
  next?.(e);
}

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
      {...fieldIds(name)}
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
      onFocus={(e) => { chainFocus(true, setFocused, inputProps?.onFocus, e); }}
      onBlur={(e) => { chainFocus(false, setFocused, inputProps?.onBlur, e); }}
      style={[box, text, disabled && { opacity: 0.5 }, style]}
    />
  );
});
