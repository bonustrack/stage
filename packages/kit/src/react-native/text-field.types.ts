import type { ReactNode } from 'react';
import type {
  NativeSyntheticEvent,
  ReturnKeyTypeOptions,
  StyleProp,
  TextInputKeyPressEventData,
  TextInputProps,
  TextStyle,
} from 'react-native';
import type { ValidationResult } from '../a2ui/protocol';
import type { ControlSize } from '../control.styles';
import type { A2uiCommonProps } from './a2ui-props';

export type TextFieldVariant = 'shortText' | 'longText' | 'number' | 'obscured';

export type TextFieldAppearance = 'soft' | 'outline' | 'plain' | 'filled';

export type TextFieldInputType = 'text' | 'email' | 'tel' | 'url';

export type TextFieldHintTone = 'secondary' | 'success' | 'danger';

export type TextFieldNativeProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable'>;

export interface TextFieldProps extends A2uiCommonProps {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  variant?: TextFieldVariant;
  checks?: readonly ValidationResult[];
  onChangeText?: (text: string) => void;
  onSubmit?: (text: string) => void;
  appearance?: TextFieldAppearance;
  size?: ControlSize;
  pill?: boolean;
  radius?: number | string;
  disabled?: boolean;
  inputType?: TextFieldInputType;
  autoFocus?: boolean;
  autoSelect?: boolean;
  dark?: boolean;
  placeholderTextColor?: string;
  style?: StyleProp<TextStyle>;
  inputProps?: TextFieldNativeProps;
  rows?: number;
  maxRows?: number;
  autoResize?: boolean;
  autoGrow?: boolean;
  minHeight?: number | string;
  maxHeight?: number | string;
  selection?: { start: number; end: number };
  onSelectionChange?: (range: { start: number; end: number }) => void;
  onKeyPress?: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
  focusNonce?: number;
  blurNonce?: number;
  background?: string;
  borderColor?: string;
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
  returnKeyType?: ReturnKeyTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'none';
  name?: string;
  dataSet?: Record<string, string>;
  hint?: string;
  hintTone?: TextFieldHintTone;
  hintColor?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  trailingWidth?: number;
  labelTrailing?: ReactNode;
}
