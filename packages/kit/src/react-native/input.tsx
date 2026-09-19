
import { forwardRef } from 'react';
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
  fieldIds,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { CONTROL_RADIUS_DEFAULT } from '../tokens';

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

  const colors = controlColors(variant, dark);
  const corner = radius ?? (pill ? 999 : CONTROL_RADIUS_DEFAULT);
  const box = controlBoxStyle(size, variant, colors, corner);
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
      style={[box, text, disabled && { opacity: 0.5 }, style]}
    />
  );
});
