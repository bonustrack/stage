
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
  blurNonce?: number;
  variant?: TextFieldVariant;
  background?: string;
  borderColor?: string;
  radius?: number | string;
  paddingX?: number | string;
  paddingY?: number | string;
  paddingTop?: number | string;
  paddingBottom?: number | string;
  lineHeight?: number;
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

function useNonce(nonce: number | undefined, run: () => void): void {
  useEffect(() => {
    if (nonce === undefined) return;
    run();
  }, [nonce]);
}

function sizeStyle(input: {
  multiline?: boolean;
  autoGrow?: boolean;
  maxHeight?: number | string;
  minHeight?: number | string;
}): TextStyle {
  const maxH = input.maxHeight as DimensionValue | undefined;
  const minH = input.minHeight as DimensionValue | undefined;
  if (input.multiline === true) {
    return {
      minHeight: minH ?? (input.autoGrow === true ? 44 : 88),
      maxHeight: maxH,
      height: undefined,
      textAlignVertical: 'top',
    };
  }
  return { maxHeight: maxH, ...(minH === undefined ? null : { minHeight: minH }) };
}

function overrideStyle(input: {
  paddingTop?: number | string;
  paddingBottom?: number | string;
  lineHeight?: number;
}): TextStyle {
  return {
    ...(input.paddingTop === undefined
      ? null
      : { paddingTop: input.paddingTop as DimensionValue }),
    ...(input.paddingBottom === undefined
      ? null
      : { paddingBottom: input.paddingBottom as DimensionValue }),
    ...(input.lineHeight === undefined ? null : { lineHeight: input.lineHeight }),
  };
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
    blurNonce,
    variant,
    background,
    borderColor,
    radius,
    paddingX,
    paddingY,
    paddingTop,
    paddingBottom,
    lineHeight,
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
  useNonce(focusNonce, () => ref.current?.focus());
  useNonce(blurNonce, () => ref.current?.blur());

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
  const extra = sizeStyle({ multiline, autoGrow, maxHeight, minHeight });
  const overrides = overrideStyle({ paddingTop, paddingBottom, lineHeight });

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
      style={[
        styled.box,
        styled.text,
        extra,
        overrides,
        disabled ? { opacity: 0.5 } : null,
      ]}
    />
  );
}
