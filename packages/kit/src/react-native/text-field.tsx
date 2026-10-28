import { forwardRef } from 'react';
import { Platform, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData } from 'react-native';
import { FilledField } from './text-field.filled';
import { AreaField, InputField } from './text-field.input';
import { PlainField } from './text-field.plain';
import type { TextFieldProps } from './text-field.types';

export type {
  TextFieldAppearance, TextFieldHintTone, TextFieldInputType, TextFieldNativeProps, TextFieldProps, TextFieldVariant,
} from './text-field.types';

export const SEARCH_INPUT_PROPS = Platform.OS === 'web' ? {
  inputMode: 'search' as const,
  autoComplete: 'off' as const,
  dataSet: { 'protonpass-ignore': '', '1p-ignore': '' },
  onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>): void => {
    if (event.nativeEvent.key === 'Escape') event.preventDefault();
  },
} : {};

export { FORM_FIELD_HEIGHT, FORM_FIELD_RADIUS } from './text-field.filled';

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(props, ref) {
  if (props.label !== undefined || props.appearance === 'filled') return <FilledField {...props} ref={ref} />;
  if (props.appearance === 'plain') return <PlainField {...props} ref={ref} />;
  if (props.variant === 'longText') return <AreaField {...props} ref={ref} />;
  return <InputField {...props} ref={ref} />;
});
