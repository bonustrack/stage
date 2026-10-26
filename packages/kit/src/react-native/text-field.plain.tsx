import { forwardRef, useCallback, useEffect, useRef, useState, type Ref, type RefObject } from 'react';
import { Platform, TextInput, type DimensionValue, type TextStyle } from 'react-native';
import { controlColors, textFieldStyle } from '../control.styles';
import { accessibilityProps, weightStyle } from './a2ui-props';
import { useKitScheme } from './theme-context';
import type { TextFieldProps } from './text-field.types';
import { loadKitFonts } from './fonts.load';

loadKitFonts();

function useNonce(nonce: number | undefined, run: () => void): void {
  useEffect(() => {
    if (nonce === undefined) return;
    run();
  }, [nonce]);
}

function sizeStyle(multiline: boolean, props: TextFieldProps, height: number | undefined): TextStyle {
  const maxH = props.maxHeight as DimensionValue | undefined;
  const minH = props.minHeight as DimensionValue | undefined;
  if (multiline) {
    return { minHeight: minH ?? (props.autoGrow === true ? 44 : 88), maxHeight: maxH, height, textAlignVertical: 'top' };
  }
  return { maxHeight: maxH, ...(minH === undefined ? null : { minHeight: minH }) };
}

function overrideStyle(props: TextFieldProps): TextStyle {
  return {
    ...(props.paddingTop === undefined ? null : { paddingTop: props.paddingTop as DimensionValue }),
    ...(props.paddingBottom === undefined ? null : { paddingBottom: props.paddingBottom as DimensionValue }),
    ...(props.lineHeight === undefined ? null : { lineHeight: props.lineHeight }),
  };
}

function useWebAutoGrow(ref: RefObject<TextInput | null>, props: TextFieldProps, multiline: boolean) {
  const { value, minHeight, maxHeight, onChangeText } = props;
  const enabled = Platform.OS === 'web' && multiline && props.autoGrow === true;
  const [height, setHeight] = useState<number | undefined>(undefined);
  const measure = useCallback((): void => {
    const node = ref.current as unknown as { style: { height: string }; scrollHeight: number } | null;
    if (!enabled || node === null) return;
    const min = typeof minHeight === 'number' ? minHeight : 44;
    const max = typeof maxHeight === 'number' ? maxHeight : Number.POSITIVE_INFINITY;
    node.style.height = 'auto';
    const next = Math.min(max, Math.max(min, node.scrollHeight));
    node.style.height = `${next}px`;
    setHeight(next);
  }, [ref, enabled, minHeight, maxHeight]);
  useEffect(() => {
    measure();
  }, [measure, value]);
  if (!enabled) return { height: undefined, onChangeText };
  return {
    height,
    onChangeText: (text: string): void => {
      onChangeText?.(text);
      measure();
    },
  };
}

function assignRef<T>(ref: Ref<T> | undefined, node: T | null): void {
  if (typeof ref === 'function') ref(node);
  else if (ref !== null && ref !== undefined) ref.current = node;
}

export const PlainField = forwardRef<TextInput, TextFieldProps>(function PlainField(props, ref) {
  const inner = useRef<TextInput | null>(null);
  const scheme = useKitScheme();
  useNonce(props.focusNonce, () => inner.current?.focus());
  useNonce(props.blurNonce, () => inner.current?.blur());
  const multiline = props.variant === 'longText';
  const grow = useWebAutoGrow(inner, props, multiline);
  const styled = textFieldStyle({ ...props, baseColors: controlColors('soft', props.dark ?? scheme === 'dark') });
  const { onSelectionChange, onSubmit } = props;
  return (
    <TextInput
      {...(props.dataSet === undefined ? null : { dataSet: props.dataSet })}
      ref={(node) => {
        inner.current = node;
        assignRef(ref, node);
      }}
      {...accessibilityProps(props.accessibility)}
      value={props.value}
      defaultValue={props.defaultValue}
      placeholder={props.placeholder}
      placeholderTextColor={props.placeholderColor ?? props.placeholderTextColor ?? styled.placeholder}
      editable={!props.disabled}
      autoFocus={props.autoFocus}
      multiline={multiline}
      numberOfLines={props.rows}
      maxLength={props.maxLength}
      returnKeyType={props.returnKeyType}
      autoCapitalize={props.autoCapitalize}
      autoCorrect={props.autoCorrect}
      inputMode={props.inputMode}
      secureTextEntry={props.variant === 'obscured' ? true : undefined}
      onChangeText={grow.onChangeText}
      onSubmitEditing={onSubmit === undefined ? undefined : (e) => { onSubmit(e.nativeEvent.text); }}
      onKeyPress={props.onKeyPress}
      selection={props.selection}
      onSelectionChange={onSelectionChange === undefined ? undefined : (event) => { onSelectionChange(event.nativeEvent.selection); }}
      style={[styled.box, styled.text, sizeStyle(multiline, props, grow.height), overrideStyle(props), weightStyle(props.weight), props.disabled === true ? { opacity: 0.5 } : null, props.style]}
    />
  );
});
