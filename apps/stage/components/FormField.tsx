import type { ReactNode } from 'react';
import type { TextInputProps } from 'react-native';
import { Input, type InputProps } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Text } from '@stage-labs/kit/react-native/text';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Col, Row } from './layout';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';

export const FORM_FIELD_RADIUS = 4;

const FIELD_PADDING_X = 16;
const FIELD_PADDING_TOP = 8;
const FIELD_PADDING_BOTTOM = 12;
const TRAILING_SLOT = 24;

type NativeInputProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'>;

export interface FormFieldProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  inputType?: InputProps['inputType'];
  inputProps?: NativeInputProps;
  onSubmit?: (text: string) => void;
  trailing?: ReactNode;
  labelTrailing?: ReactNode;
  hint?: string;
  hintColor?: string;
  hintTone?: 'secondary' | 'success' | 'danger';
}

function useFieldText(): { color: string; fontFamily: string; fontSize: number } {
  const { link } = usePalette();
  return { color: link, fontFamily: fontName.sans, fontSize: fontSize('2xl') };
}

function FieldHint({ hint, color }: { hint?: string; color: string }): React.ReactElement | null {
  if (hint === undefined) return null;
  return <Text value={hint} size="md" color={color} style={{ paddingHorizontal: 4 }} />;
}

const BARE_INPUT = {
  backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
  paddingHorizontal: 0, paddingVertical: 0, minHeight: 0,
} as const;

export function FormField({
  label, value, onChangeText, placeholder, multiline, rows = 3, disabled, inputType, inputProps, onSubmit, trailing, labelTrailing, hint, hintColor, hintTone = 'secondary',
}: FormFieldProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const { sub, border } = pal;
  const toneColor = { secondary: 'secondary', success: pal.success, danger: pal.danger }[hintTone];
  const textStyle = useFieldText();
  const field = multiline ? (
    <Textarea value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={sub}
      dark={dark} disabled={disabled} rows={rows} inputProps={inputProps}
      style={{ ...BARE_INPUT, ...textStyle, textAlignVertical: 'top', height: undefined, minHeight: rows * 26 }} />
  ) : (
    <Input value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={sub}
      dark={dark} disabled={disabled} inputType={inputType} inputProps={inputProps} onSubmit={onSubmit}
      style={{ ...BARE_INPUT, ...textStyle, flex: 1 }} />
  );
  return (
    <Col gap={hint === undefined ? 0 : 6}>
      <Col background={border} radius={FORM_FIELD_RADIUS} padding={{ x: FIELD_PADDING_X, top: FIELD_PADDING_TOP, bottom: FIELD_PADDING_BOTTOM }} gap={2}
        style={disabled === true ? { opacity: 0.6 } : undefined}>
        <Row align="center" gap={6}>
          <Text value={label} size="lg" color="secondary" />
          {labelTrailing}
        </Row>
        <Row align="center" gap={8} minHeight={TRAILING_SLOT}>
          {field}
          {trailing === undefined ? null : <Row align="center" height={TRAILING_SLOT} style={{ flexShrink: 0 }}>{trailing}</Row>}
        </Row>
      </Col>
      <FieldHint hint={hint} color={hintColor ?? toneColor} />
    </Col>
  );
}
