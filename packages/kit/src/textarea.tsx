/**
 * @file Textarea — a hook-free ChatKit-styled multi-line text field (controlled `value` + `onChangeText`) where `rows`/`maxRows` bound the height and `autoResize` grows it with content.
 */

import { forwardRef, useState } from 'react';
import {
  TextInput,
  type TextInputProps,
  type StyleProp,
  type TextStyle,
} from 'react-native';

/** The focus/blur event type accepted by RN TextInput's onFocus handler. */
type FocusEv = Parameters<NonNullable<TextInputProps['onFocus']>>[0];
/** The content-size event type accepted by RN TextInput's onContentSizeChange. */
type ContentSizeEv = Parameters<NonNullable<TextInputProps['onContentSizeChange']>>[0];
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

/** Accessibility id pair derived from the field `name`. */
function fieldIds(name: string | undefined): { nativeID?: string; accessibilityLabelledBy?: string } {
  if (!name) return {};
  return { nativeID: `input-${name}`, accessibilityLabelledBy: `label-${name}` };
}

/** Set focus state then forward the event to the caller's handler. */
function chainFocus(
  focused: boolean,
  setFocused: (v: boolean) => void,
  next: ((e: FocusEv) => void) | undefined,
  e: FocusEv,
): void {
  setFocused(focused);
  next?.(e);
}

/** Resolve the rendered height from rows/maxRows/autoResize + content height. */
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

  const resolvedH = resolveHeight(size, rows, maxRows, autoResize, contentHeight);

  /** Track content size growth and forward the event. */
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
      onFocus={(e) => { chainFocus(true, setFocused, inputProps?.onFocus, e); }}
      onBlur={(e) => { chainFocus(false, setFocused, inputProps?.onBlur, e); }}
      textAlignVertical="top"
      style={[box, text, { height: resolvedH }, disabled && { opacity: 0.5 }, style]}
    />
  );
});
