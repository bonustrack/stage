import { forwardRef, useState } from 'react';
import { TextInput, type KeyboardTypeOptions, type TextInputProps, type TextStyle, type ViewStyle } from 'react-native';
import {
  CONTROL_SIZES, controlBoxStyle, controlColors, controlTextStyle, fieldIds,
  type ControlSize, type ControlVariant,
} from '../control.styles';
import { CONTROL_RADIUS_DEFAULT } from '../tokens';
import { accessibilityProps, weightStyle } from './a2ui-props';
import { useKitScheme } from './theme-context';
import type { TextFieldInputType, TextFieldProps } from './text-field.types';
import { loadKitFonts } from './fonts.load';

loadKitFonts();

type ContentSizeEvent = Parameters<NonNullable<TextInputProps['onContentSizeChange']>>[0];

const KEYBOARD: Record<TextFieldInputType, KeyboardTypeOptions> = {
  text: 'default',
  email: 'email-address',
  tel: 'phone-pad',
  url: 'url',
};

function keyboardFor(props: TextFieldProps): KeyboardTypeOptions {
  return props.variant === 'number' ? 'numeric' : KEYBOARD[props.inputType ?? 'text'];
}

function cornerOf(props: TextFieldProps, pill: boolean): number {
  if (typeof props.radius === 'number') return props.radius;
  return pill ? 999 : CONTROL_RADIUS_DEFAULT;
}

function appearanceOf(props: TextFieldProps): ControlVariant {
  return props.appearance === 'outline' ? 'outline' : 'soft';
}

function useDark(dark: boolean | undefined): boolean {
  const scheme = useKitScheme();
  return dark ?? scheme === 'dark';
}

function useControlStyle(props: TextFieldProps, pill: boolean): { box: ViewStyle; text: TextStyle; placeholder: string } {
  const colors = controlColors(appearanceOf(props), useDark(props.dark));
  const size: ControlSize = props.size ?? 'md';
  return {
    box: controlBoxStyle(size, appearanceOf(props), colors, cornerOf(props, pill)),
    text: controlTextStyle(size, colors),
    placeholder: props.placeholderTextColor ?? props.placeholderColor ?? colors.placeholder,
  };
}

function sharedInputProps(props: TextFieldProps, placeholderTextColor: string): TextInputProps {
  return {
    ...fieldIds(props.name),
    ...accessibilityProps(props.accessibility),
    value: props.value,
    defaultValue: props.defaultValue,
    placeholder: props.placeholder,
    placeholderTextColor,
    editable: !props.disabled,
    autoFocus: props.autoFocus,
    selectTextOnFocus: props.autoSelect,
    onChangeText: props.onChangeText,
  };
}

export const InputField = forwardRef<TextInput, TextFieldProps>(function InputField(props, ref) {
  const { inputProps, disabled, style, onSubmit } = props;
  const styled = useControlStyle(props, props.pill === true);
  return (
    <TextInput
      {...inputProps}
      ref={ref}
      {...sharedInputProps(props, styled.placeholder)}
      keyboardType={keyboardFor(props)}
      secureTextEntry={props.variant === 'obscured'}
      onSubmitEditing={(e) => {
        onSubmit?.(e.nativeEvent.text);
        inputProps?.onSubmitEditing?.(e);
      }}
      style={[styled.box, styled.text, weightStyle(props.weight), disabled && { opacity: 0.5 }, style]}
    />
  );
});

function areaHeight(size: ControlSize, props: TextFieldProps, contentHeight: number | undefined): number {
  const lh = Math.round(CONTROL_SIZES[size].fontSize * 1.4);
  const minH = (props.rows ?? 3) * lh;
  if (props.autoResize === false) return minH;
  const maxH = props.maxRows === undefined ? Number.MAX_SAFE_INTEGER : props.maxRows * lh;
  return Math.min(Math.max(contentHeight ?? minH, minH), maxH);
}

export const AreaField = forwardRef<TextInput, TextFieldProps>(function AreaField(props, ref) {
  const { inputProps, disabled, style } = props;
  const [contentHeight, setContentHeight] = useState<number | undefined>(undefined);
  const styled = useControlStyle(props, false);
  const height = areaHeight(props.size ?? 'md', props, contentHeight);
  const onContentSize = (e: ContentSizeEvent): void => {
    if (props.autoResize !== false) setContentHeight(e.nativeEvent.contentSize.height);
    inputProps?.onContentSizeChange?.(e);
  };
  return (
    <TextInput
      {...inputProps}
      ref={ref}
      multiline
      {...sharedInputProps(props, styled.placeholder)}
      onContentSizeChange={onContentSize}
      textAlignVertical="top"
      style={[styled.box, styled.text, { height }, weightStyle(props.weight), disabled && { opacity: 0.5 }, style]}
    />
  );
});
