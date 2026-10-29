import { useEffect, useRef, type ComponentRef, type ReactNode, type Ref, type RefObject } from 'react';
import type { TextInputProps } from 'react-native';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';
import { TextField, type TextFieldProps } from '@stage-labs/kit/react-native/text-field';

export { FORM_FIELD_HEIGHT, FORM_FIELD_RADIUS } from '@stage-labs/kit/react-native/text-field';

type NativeInputProps = Omit<
  TextInputProps,
  'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'
>;

interface FormFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  inputType?: TextFieldProps['inputType'];
  variant?: 'shortText' | 'number' | 'obscured';
  inputProps?: NativeInputProps;
  inputRef?: Ref<ComponentRef<typeof TextField>>;
  autoFocus?: boolean;
  onSubmit?: (text: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  trailingWidth?: number;
  labelTrailing?: ReactNode;
  hint?: string;
  hintTone?: 'secondary' | 'success' | 'danger';
}

export function useFocusOnOpen(): RefObject<ComponentRef<typeof TextField> | null> {
  const ref = useRef<ComponentRef<typeof TextField>>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      ref.current?.focus();
    }, 0);
    return () => {
      clearTimeout(timer);
    };
  }, []);
  return ref;
}

export function useFieldColors(): { background: string; text: string; placeholder: string } {
  const { border, link, sub } = usePalette();
  return { background: border, text: link, placeholder: sub };
}

export function FormField({
  label,
  value,
  onChangeText,
  placeholder,
  multiline,
  rows = 3,
  disabled,
  inputType,
  variant,
  inputProps,
  inputRef,
  autoFocus,
  onSubmit,
  leading,
  trailing,
  trailingWidth,
  labelTrailing,
  hint,
  hintTone,
}: FormFieldProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const line = multiline === true ? {} : { ref: inputRef, variant, inputType, autoFocus, onSubmit };
  return (
    <TextField
      appearance="filled"
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      dark={dark}
      disabled={disabled}
      variant={multiline === true ? 'longText' : undefined}
      rows={rows}
      inputProps={inputProps}
      {...line}
      leading={leading}
      trailing={trailing}
      trailingWidth={trailingWidth}
      labelTrailing={labelTrailing}
      hint={hint}
      hintTone={hintTone}
    />
  );
}
