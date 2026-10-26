import { forwardRef } from 'react';
import { Platform, type NativeSyntheticEvent, type TextInput, type TextInputKeyPressEventData, type TextStyle } from 'react-native';
import { fontName, fontSize, type KitPalette } from '../tokens';
import { firstCheckMessage } from './a2ui-props';
import { Column } from './column';
import { Row } from './row';
import { Text } from './text';
import { AreaField, InputField } from './text-field.input';
import { PlainField } from './text-field.plain';
import type { TextFieldHintTone, TextFieldProps } from './text-field.types';
import { useKitPalette } from './theme-context';

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

export const FORM_FIELD_RADIUS = 4;

const FIELD_PADDING_X = 16;
const FIELD_PADDING_TOP = 8;
const FIELD_PADDING_BOTTOM = 12;
const TRAILING_SLOT = 24;
const MULTILINE_ROW_HEIGHT = 26;

const BARE_INPUT: TextStyle = {
  backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
  paddingHorizontal: 0, paddingVertical: 0, minHeight: 0,
};

function toneColor(tone: TextFieldHintTone, palette: KitPalette): string {
  if (tone === 'success') return palette.success;
  if (tone === 'danger') return palette.danger;
  return 'secondary';
}

function resolveHint(props: TextFieldProps, palette: KitPalette): { hint: string | undefined; color: string } {
  const failed = firstCheckMessage(props.checks);
  if (failed !== undefined) return { hint: failed, color: palette.danger };
  return { hint: props.hint, color: props.hintColor ?? toneColor(props.hintTone ?? 'secondary', palette) };
}

const LabeledField = forwardRef<TextInput, TextFieldProps>(function LabeledField(props, ref) {
  const palette = useKitPalette();
  const { hint, color } = resolveHint(props, palette);
  const rows = props.rows ?? 3;
  const textStyle: TextStyle = { color: palette.link, fontFamily: fontName.sans, fontSize: fontSize('md') };
  const inner: TextFieldProps = {
    ...props, label: undefined, weight: undefined, appearance: 'soft', placeholderTextColor: props.placeholderTextColor ?? palette.sub, rows,
  };
  const field = props.variant === 'longText'
    ? <AreaField {...inner} ref={ref} style={{ ...BARE_INPUT, ...textStyle, textAlignVertical: 'top', height: undefined, minHeight: rows * MULTILINE_ROW_HEIGHT }} />
    : <InputField {...inner} ref={ref} style={{ ...BARE_INPUT, ...textStyle, flex: 1 }} />;
  return (
    <Column gap={hint === undefined ? 0 : 6} weight={props.weight}>
      <Column background={palette.border} radius={FORM_FIELD_RADIUS} padding={{ x: FIELD_PADDING_X, top: FIELD_PADDING_TOP, bottom: FIELD_PADDING_BOTTOM }} gap={2}
        style={props.disabled === true ? { opacity: 0.6 } : undefined}>
        <Row align="center" gap={6}>
          <Text text={props.label} size="xs" color="secondary" />
          {props.labelTrailing}
        </Row>
        <Row align="center" gap={8} minHeight={TRAILING_SLOT}>
          {field}
          {props.trailing === undefined ? null : <Row align="center" height={TRAILING_SLOT} style={{ flexShrink: 0 }}>{props.trailing}</Row>}
        </Row>
      </Column>
      {hint === undefined ? null : <Text text={hint} size="xs" color={color} style={{ paddingHorizontal: 4 }} />}
    </Column>
  );
});

export const TextField = forwardRef<TextInput, TextFieldProps>(function TextField(props, ref) {
  if (props.label !== undefined) return <LabeledField {...props} ref={ref} />;
  if (props.appearance === 'plain') return <PlainField {...props} ref={ref} />;
  if (props.variant === 'longText') return <AreaField {...props} ref={ref} />;
  return <InputField {...props} ref={ref} />;
});
