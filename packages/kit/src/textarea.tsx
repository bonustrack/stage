/**
 * @file Textarea — a hook-free ChatKit-styled multi-line text field (controlled `value` + `onChangeText`) where `rows`/`maxRows` bound the height and `autoResize` grows it with content.
 */

import { forwardRef, useState } from 'react';
import { TextInput, type TextInputProps, type StyleProp, type TextStyle } from 'react-native';
import {
  CONTROL_SIZES,
  controlBoxStyle,
  controlColors,
  controlTextStyle,
  type ControlSize,
  type ControlVariant,
} from './control.styles';
import { BLOCK_RADIUS_DEFAULT } from './tokens';

/** Approx line height per ControlSize, used to map rows -> px height. */
function lineHeight(size: ControlSize): number {
  return Math.round(CONTROL_SIZES[size].fontSize * 1.4);
}

export interface TextareaProps {
  /** ChatKit: name. Form field name (required). */
  name?: string;
  /** ChatKit: defaultValue. */
  defaultValue?: string;
  /** Controlled value (kit extension; pair with onChangeText). */
  value?: string;
  /** ChatKit: placeholder. */
  placeholder?: string;
  /** ChatKit: variant. Default 'soft'. */
  variant?: ControlVariant;
  /** ChatKit: size. Default 'md'. */
  size?: ControlSize;
  /** ChatKit: disabled. */
  disabled?: boolean;
  /** ChatKit: rows. Initial visible rows. Default 3. */
  rows?: number;
  /** ChatKit: maxRows. Cap for autoResize growth. */
  maxRows?: number;
  /** ChatKit: autoResize. Grow with content up to maxRows. Default true. */
  autoResize?: boolean;
  /** ChatKit: autoFocus. */
  autoFocus?: boolean;
  /** ChatKit: autoSelect. */
  autoSelect?: boolean;
  /** ChatKit: required (parity only). */
  required?: boolean;
  /** ChatKit: pattern (parity only). */
  pattern?: string;
  /** Corner radius (px). Falls back to the block radius token. */
  radius?: number;
  /** Called on each keystroke (RN substitute for onChangeAction). */
  onChangeText?: (text: string) => void;
  /** Effective color scheme. */
  dark?: boolean;
  /** Override the placeholder colour (else derived from variant/scheme). */
  placeholderTextColor?: string;
  /** Escape-hatch style merged last onto the box (accepts text + view style). */
  style?: StyleProp<TextStyle>;
  /** Extra RN TextInput props. Its onFocus/onBlur/onContentSizeChange are chained after the kit handlers. */
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'
  >;
}

/** ChatKit-style RN multi-line input. Forwards a ref to the underlying RN TextInput so call sites can focus/blur it. */
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
  const [focused, setFocused] = useState(false);
  const colors = controlColors(variant, dark);
  const corner = radius ?? BLOCK_RADIUS_DEFAULT;
  const box = controlBoxStyle(size, variant, colors, corner, focused);
  const text = controlTextStyle(size, colors);

  const lh = lineHeight(size);
  const minH = rows * lh;
  const maxH = maxRows ? maxRows * lh : undefined;
  const resolvedH = autoResize
    ? Math.min(Math.max(contentHeight ?? minH, minH), maxH ?? Number.MAX_SAFE_INTEGER)
    : minH;

  return (
    <TextInput
      {...inputProps}
      ref={ref}
      multiline
      nativeID={name ? `input-${name}` : undefined}
      accessibilityLabelledBy={name ? `label-${name}` : undefined}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      placeholderTextColor={placeholderTextColor ?? colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      selectTextOnFocus={autoSelect}
      onChangeText={onChangeText}
      onContentSizeChange={(e) => {
        if (autoResize) setContentHeight(e.nativeEvent.contentSize.height);
        inputProps?.onContentSizeChange?.(e);
      }}
      onFocus={(e) => {
        setFocused(true);
        inputProps?.onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        inputProps?.onBlur?.(e);
      }}
      textAlignVertical="top"
      style={[box, text, { height: resolvedH }, disabled && { opacity: 0.5 }, style]}
    />
  );
});
