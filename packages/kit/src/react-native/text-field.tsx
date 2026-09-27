
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import {
  Platform,
  TextInput,
  type DimensionValue,
  type NativeSyntheticEvent,
  type ReturnKeyTypeOptions,
  type TextInputKeyPressEventData,
  type TextStyle,
} from 'react-native';
import {
  controlColors,
  textFieldStyle,
  type ResolvedTextFieldStyle,
  type TextFieldVariant,
} from '../control.styles';
import { CONTROL_RADIUS_DEFAULT } from '../tokens';

export interface TextFieldProps {
  name?: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  autoFocus?: boolean;
  autoGrow?: boolean;
  disabled?: boolean;
  onChangeText?: (text: string) => void;
  selection?: { start: number; end: number };
  onSelectionChange?: (range: { start: number; end: number }) => void;
  onSubmit?: () => void;
  onKeyPress?: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => void;
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
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'none';
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
  height?: number;
}): TextStyle {
  const maxH = input.maxHeight as DimensionValue | undefined;
  const minH = input.minHeight as DimensionValue | undefined;
  if (input.multiline === true) {
    return {
      minHeight: minH ?? (input.autoGrow === true ? 44 : 88),
      maxHeight: maxH,
      height: input.height,
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

function resolveStyled(props: TextFieldProps): ResolvedTextFieldStyle {
  const baseColors = controlColors(
    props.variant === 'plain' ? 'soft' : 'outline',
    props.dark ?? false,
  );
  return textFieldStyle({
    variant: props.variant,
    defaultRadius: CONTROL_RADIUS_DEFAULT,
    baseColors,
    background: props.background,
    borderColor: props.borderColor,
    radius: props.radius,
    paddingX: props.paddingX,
    paddingY: props.paddingY,
    fontSize: props.fontSize,
    fontFamily: props.fontFamily,
    color: props.color,
  });
}

function useWebAutoGrow(
  ref: RefObject<TextInput | null>,
  props: TextFieldProps,
): { height: number | undefined; onChangeText: TextFieldProps['onChangeText'] } {
  const { value, minHeight, maxHeight, onChangeText } = props;
  const enabled =
    Platform.OS === 'web' && props.multiline === true && props.autoGrow === true;
  const [height, setHeight] = useState<number | undefined>(undefined);
  const measure = useCallback((): void => {
    const node = ref.current as unknown as {
      style: { height: string };
      scrollHeight: number;
    } | null;
    if (!enabled || node === null) {
      return;
    }
    const min = typeof minHeight === 'number' ? minHeight : 44;
    const max =
      typeof maxHeight === 'number' ? maxHeight : Number.POSITIVE_INFINITY;
    node.style.height = 'auto';
    const next = Math.min(max, Math.max(min, node.scrollHeight));
    node.style.height = `${next}px`;
    setHeight(next);
  }, [ref, enabled, minHeight, maxHeight]);
  useEffect(() => {
    measure();
  }, [measure, value]);
  if (!enabled) {
    return { height: undefined, onChangeText };
  }
  return {
    height,
    onChangeText: (text: string): void => {
      onChangeText?.(text);
      measure();
    },
  };
}

export function TextField(props: TextFieldProps): React.ReactElement {
  const {
    value,
    placeholder,
    multiline,
    rows,
    autoFocus,
    disabled,
    selection,
    onSelectionChange,
    onSubmit,
    onKeyPress,
    focusNonce,
    blurNonce,
    placeholderColor,
    maxLength,
    returnKeyType,
    autoCapitalize,
    autoCorrect,
    inputMode,
  } = props;
  const ref = useRef<TextInput>(null);
  useNonce(focusNonce, () => ref.current?.focus());
  useNonce(blurNonce, () => ref.current?.blur());
  const autoGrow = useWebAutoGrow(ref, props);

  const styled = resolveStyled(props);
  const extra = sizeStyle({
    multiline,
    autoGrow: props.autoGrow,
    maxHeight: props.maxHeight,
    minHeight: props.minHeight,
    height: autoGrow.height,
  });
  const overrides = overrideStyle({
    paddingTop: props.paddingTop,
    paddingBottom: props.paddingBottom,
    lineHeight: props.lineHeight,
  });

  return (
    <TextInput
      ref={ref}
      value={value}
      placeholder={placeholder}
      placeholderTextColor={placeholderColor ?? styled.placeholder}
      editable={!disabled}
      autoFocus={autoFocus}
      multiline={multiline}
      numberOfLines={rows}
      maxLength={maxLength}
      returnKeyType={returnKeyType}
      autoCapitalize={autoCapitalize}
      autoCorrect={autoCorrect}
      inputMode={inputMode}
      onChangeText={autoGrow.onChangeText}
      onSubmitEditing={onSubmit}
      onKeyPress={onKeyPress}
      selection={selection}
      onSelectionChange={
        onSelectionChange === undefined
          ? undefined
          : (event) => {
              onSelectionChange(event.nativeEvent.selection);
            }
      }
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
