
import { useState } from 'react';
import { TextInput, type TextStyle } from 'react-native';
import {
  controlBoxStyle,
  controlColors,
  controlTextStyle,
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
    dark = false,
  } = props;
  const [focused, setFocused] = useState(false);
  const colors = controlColors('outline', dark);
  const box = controlBoxStyle('md', 'outline', colors, BLOCK_RADIUS_DEFAULT, focused);
  const text = controlTextStyle('md', colors);
  const grow: TextStyle = multiline
    ? { minHeight: autoGrow ? 44 : 88, height: undefined, textAlignVertical: 'top' }
    : {};

  return (
    <TextInput
      value={value}
      placeholder={placeholder}
      placeholderTextColor={colors.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      multiline={multiline}
      onChangeText={onChangeText}
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
      style={[box, text, grow, disabled ? { opacity: 0.5 } : null]}
    />
  );
}
