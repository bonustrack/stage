
import { forwardRef, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

type ContentSizeEv = Parameters<NonNullable<TextInputProps['onContentSizeChange']>>[0];
import {
  CONTROL_SIZES,
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  fieldIds,
  type ControlSize,
  type ControlVariant,
} from '../control.styles';
import { CONTROL_RADIUS_DEFAULT } from '../tokens';

function lineHeight(size: ControlSize): number {
  return Math.round(CONTROL_SIZES[size].fontSize * 1.4);
}

export interface TextareaProps {
  name?: string;
  defaultValue?: string;
  value?: string;
  placeholder?: string;
  variant?: ControlVariant;
  size?: ControlSize;
  disabled?: boolean;
  rows?: number;
  maxRows?: number;
  autoResize?: boolean;
  autoFocus?: boolean;
  autoSelect?: boolean;
  required?: boolean;
  pattern?: string;
  radius?: number;
  onChangeText?: (text: string) => void;
  dark?: boolean;
  placeholderTextColor?: string;
  style?: StyleProp<TextStyle>;
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'
  >;
}

function resolveHeight(
  size: ControlSize,
  rows: number,
  maxRows: number | undefined,
  autoResize: boolean,
  contentHeight: number | undefined,
): number {
  const lh = lineHeight(size);
  const minH = rows * lh;
  if (!autoResize) return minH;
  const maxH = maxRows ? maxRows * lh : Number.MAX_SAFE_INTEGER;
  return Math.min(Math.max(contentHeight ?? minH, minH), maxH);
}

export const Textarea = forwardRef<TextInput, TextareaProps>(function Textarea(props, ref) {
  const {
    name,
    defaultValue,
    value,
    placeholder,
    variant = 'soft',
    size = 'md',
    disabled,
    rows = 3,
    maxRows,
    autoResize = true,
    autoFocus,
    autoSelect,
    radius,
    onChangeText,
    dark = false,
    placeholderTextColor,
    style,
    inputProps,
  } = props;

  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  const colors = controlColors(variant, dark);
  const corner = radius ?? CONTROL_RADIUS_DEFAULT;
  const box = controlBoxStyle(size, variant, colors, corner);
  const text = controlTextStyle(size, colors);

  const resolvedH = resolveHeight(size, rows, maxRows, autoResize, contentHeight);

  function handleContentSize(e: ContentSizeEv): void {
    if (autoResize) setContentHeight(e.nativeEvent.contentSize.height);
    inputProps?.onContentSizeChange?.(e);
  }

  return (
    <TextInput
      {...inputProps}
      ref={ref}
      multiline
      {...fieldIds(name)}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      selectTextOnFocus={autoSelect}
      onChangeText={onChangeText}
      onContentSizeChange={handleContentSize}
      textAlignVertical="top"
      style={[box, text, { height: resolvedH }, disabled && { opacity: 0.5 }, style]}
    />
  );
});
