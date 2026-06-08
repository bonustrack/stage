/** Textarea - a ChatKit-styled multi-line text field. Mirrors ChatKit's
 *  `Textarea` widget. Faithful prop names: `name`, `defaultValue`,
 *  `placeholder`, `variant`, `size`, `disabled`, `rows`, `maxRows`,
 *  `autoResize`, `autoFocus`, `autoSelect`, `required`, `pattern`. Same kit
 *  deviations as Input: a controlled `value` + `onChangeText` callback (RN
 *  substitute for ChatKit's onChangeAction) and a `dark` boolean. `rows`/`maxRows`
 *  bound the height; `autoResize` lets it grow with content up to `maxRows`. */

import { useState } from 'react';
import { TextInput, type TextInputProps, type ViewStyle } from 'react-native';
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
  /** Escape-hatch style merged last onto the box. */
  style?: ViewStyle | ViewStyle[];
  /** Extra RN TextInput props. */
  inputProps?: Omit<
    TextInputProps,
    'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'
  >;
}

/** ChatKit-style RN multi-line input. */
export function Textarea(props: TextareaProps): React.ReactElement {
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
      multiline
      nativeID={name ? `input-${name}` : undefined}
      accessibilityLabelledBy={name ? `label-${name}` : undefined}
      value={value}
      defaultValue={defaultValue}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      selectTextOnFocus={autoSelect}
      onChangeText={onChangeText}
      onContentSizeChange={
        autoResize ? (e) => setContentHeight(e.nativeEvent.contentSize.height) : undefined
      }
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      textAlignVertical="top"
      style={[
        box,
        text,
        { height: resolvedH },
        disabled && { opacity: 0.5 },
        ...(style ? (Array.isArray(style) ? style : [style]) : []),
      ]}
    />
  );
}
