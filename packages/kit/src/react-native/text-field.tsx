
import { useEffect, useRef, useState } from 'react';
import {
  TextInput,
  type DimensionValue,
  type ReturnKeyTypeOptions,
  type TextStyle,
} from 'react-native';
import {
  controlColors,
  textFieldStyle,
  type TextFieldVariant,
} from '../control.styles';
import { BLOCK_RADIUS_DEFAULT } from '../tokens';

export interface TextFieldProps {
  name?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  autoFocus?: boolean;
  autoGrow?: boolean;
  disabled?: boolean;
  onChangeText?: (text: string) => void;
  selection?: { start: number; end: number };
  onSelectionChange?: (range: { start: number; end: number }) => void;
  onSubmit?: () => void;
  focusNonce?: number;
  variant?: TextFieldVariant;
  background?: string;
  borderColor?: string;
  radius?: number | string;
  paddingX?: number | string;
  paddingY?: number | string;
  fontSize?: number;
  fontFamily?: string;
  color?: string;
  placeholderColor?: string;
  maxLength?: number;
  maxHeight?: number | string;
  minHeight?: number | string;
  returnKeyType?: ReturnKeyTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  dark?: boolean;
}

export function TextField(props: TextFieldProps): React.ReactElement {
  const {
    value,
    placeholder,
    multiline,
    autoFocus,
    autoGrow,
    disabled,
    onChangeText,
    selection,
    onSelectionChange,
    onSubmit,
    focusNonce,
    variant,
    background,
    borderColor,
    radius,
    paddingX,
    paddingY,
    fontSize,
    fontFamily,
    color,
    placeholderColor,
    maxLength,
    maxHeight,
    minHeight,
    returnKeyType,
    autoCapitalize,
    autoCorrect,
    dark = false,
  } = props;
  const [focused, setFocused] = useState(false);
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (focusNonce === undefined) return;
    ref.current?.focus();
  }, [focusNonce]);

  const baseColors = controlColors(
    variant === 'plain' ? 'soft' : 'outline',
    dark,
  );
  const styled = textFieldStyle({
    variant,
    focused,
    defaultRadius: BLOCK_RADIUS_DEFAULT,
    baseColors,
    background,
    borderColor,
    radius,
    paddingX,
    paddingY,
    fontSize,
    fontFamily,
    color,
  });
  const maxH = maxHeight as DimensionValue | undefined;
  const minH = minHeight as DimensionValue | undefined;
  const grow: TextStyle = multiline
    ? {
        minHeight: minH ?? (autoGrow ? 44 : 88),
        maxHeight: maxH,
        height: undefined,
        textAlignVertical: 'top',
      }
    : { maxHeight: maxH };

  return (
    <TextInput
      ref={ref}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor ?? styled.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      multiline={multiline}
      maxLength={maxLength}
      returnKeyType={returnKeyType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      onChangeText={onChangeText}
      onSubmitEditing={onSubmit}
      selection={selection}
      onSelectionChange={
        onSelectionChange === undefined
          ? undefined
          : (event) => {
              onSelectionChange(event.nativeEvent.selection);
            }
      }
      onFocus={() => {
        setFocused(true);
      }}
      onBlur={() => {
        setFocused(false);
      }}
      style={[styled.box, styled.text, grow, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
