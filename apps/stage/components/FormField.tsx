import { useEffect, useRef, type ComponentRef, type ReactNode, type Ref, type RefObject } from 'react';
import type { TextInputProps, TextStyle } from 'react-native';
import { Input, type InputProps } from '@stage-labs/kit/react-native/input';
import { Textarea } from '@stage-labs/kit/react-native/textarea';
import { Text } from '@stage-labs/kit/react-native/text';
import { fontName, fontSize } from '@stage-labs/kit/tokens';
import { Box, Col, Row } from './layout';
import { useEffectiveColorScheme, usePalette } from '../lib/theme';

export const FORM_FIELD_RADIUS = 4;

const FIELD_PADDING_X = 16;
const FIELD_PADDING_TOP = 8;
const FIELD_PADDING_BOTTOM = 12;
const TRAILING_SLOT = 24;
const LEADING_SLOT = 20;
const SLOT_GAP = 8;

export const FORM_FIELD_HEIGHT = FIELD_PADDING_TOP + TRAILING_SLOT + FIELD_PADDING_BOTTOM;

type NativeInputProps = Omit<TextInputProps, 'value' | 'defaultValue' | 'onChangeText' | 'style' | 'placeholder' | 'editable' | 'multiline'>;

export interface FormFieldProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  inputType?: InputProps['inputType'];
  inputProps?: NativeInputProps;
  inputRef?: Ref<ComponentRef<typeof Input>>;
  autoFocus?: boolean;
  onSubmit?: (text: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
  labelTrailing?: ReactNode;
  hint?: string;
  hintTone?: 'secondary' | 'success' | 'danger';
}

export function useFocusOnOpen(): RefObject<ComponentRef<typeof Input> | null> {
  const ref = useRef<ComponentRef<typeof Input>>(null);
  useEffect(() => {
    const timer = setTimeout(() => { ref.current?.focus(); }, 0);
    return () => { clearTimeout(timer); };
  }, []);
  return ref;
}

export function useFieldColors(): { background: string; text: string; placeholder: string } {
  const { border, link, sub } = usePalette();
  return { background: border, text: link, placeholder: sub };
}

function useFieldText(): { color: string; fontFamily: string; fontSize: number } {
  return { color: useFieldColors().text, fontFamily: fontName.sans, fontSize: fontSize('md') };
}

function FieldHint({ hint, color }: { hint?: string; color: string }): React.ReactElement | null {
  if (hint === undefined) return null;
  return <Text value={hint} size="xs" color={color} style={{ paddingHorizontal: 4 }} />;
}

const BARE_INPUT = {
  backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
  paddingHorizontal: 0, paddingVertical: 0, minHeight: 0,
} as const;

const CENTERED_LINE = { includeFontPadding: false, textAlignVertical: 'center' } as const;
const SLOT = { position: 'absolute', top: 0, bottom: 0 } as const;

function slotInset(slot: ReactNode, width: number): number {
  return FIELD_PADDING_X + (slot === undefined ? 0 : width + SLOT_GAP);
}

function lineStyleOf(inset: boolean, leading: ReactNode, trailing: ReactNode): TextStyle {
  if (!inset) return { flex: 1 };
  return { ...CENTERED_LINE, height: FORM_FIELD_HEIGHT, paddingLeft: slotInset(leading, LEADING_SLOT), paddingRight: slotInset(trailing, TRAILING_SLOT) };
}

function InsetFrame({ field, leading, trailing, background, disabled }: {
  field: ReactNode; leading?: ReactNode; trailing?: ReactNode; background: string; disabled?: boolean;
}): React.ReactElement {
  return (
    <Box background={background} radius={FORM_FIELD_RADIUS} style={disabled === true ? { opacity: 0.6 } : undefined}>
      {field}
      {leading === undefined ? null : (
        <Row pointerEvents="none" align="center" justify="center" width={LEADING_SLOT} style={[SLOT, { left: FIELD_PADDING_X }]}>{leading}</Row>
      )}
      {trailing === undefined ? null : (
        <Row pointerEvents="box-none" align="center" style={[SLOT, { right: FIELD_PADDING_X }]}>{trailing}</Row>
      )}
    </Box>
  );
}

function StackedFrame({ field, label, labelTrailing, leading, trailing, background, disabled }: {
  field: ReactNode; label?: string; labelTrailing?: ReactNode; leading?: ReactNode; trailing?: ReactNode; background: string; disabled?: boolean;
}): React.ReactElement {
  return (
    <Col background={background} radius={FORM_FIELD_RADIUS} padding={{ x: FIELD_PADDING_X, top: FIELD_PADDING_TOP, bottom: FIELD_PADDING_BOTTOM }} gap={2}
      style={disabled === true ? { opacity: 0.6 } : undefined}>
      {label === undefined ? null : <Row align="center" gap={6}>
        <Text value={label} size="xs" color="secondary" />
        {labelTrailing}
      </Row>}
      <Row align="center" gap={8} minHeight={TRAILING_SLOT}>
        {leading}
        {field}
        {trailing === undefined ? null : <Row align="center" height={TRAILING_SLOT} style={{ flexShrink: 0 }}>{trailing}</Row>}
      </Row>
    </Col>
  );
}

export function FormField({
  label, value, onChangeText, placeholder, multiline, rows = 3, disabled, inputType, inputProps, inputRef, autoFocus, onSubmit, leading, trailing, labelTrailing, hint, hintTone = 'secondary',
}: FormFieldProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const colors = useFieldColors();
  const toneColor = { secondary: 'secondary', success: pal.success, danger: pal.danger }[hintTone];
  const textStyle = useFieldText();
  const inset = label === undefined && multiline !== true;
  const lineStyle = lineStyleOf(inset, leading, trailing);
  const field = multiline ? (
    <Textarea value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.placeholder}
      dark={dark} disabled={disabled} rows={rows} inputProps={inputProps}
      style={{ ...BARE_INPUT, ...textStyle, textAlignVertical: 'top', height: undefined, minHeight: rows * 26 }} />
  ) : (
    <Input ref={inputRef} value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={colors.placeholder}
      dark={dark} disabled={disabled} inputType={inputType} inputProps={inputProps} autoFocus={autoFocus} onSubmit={onSubmit}
      style={{ ...BARE_INPUT, ...textStyle, ...lineStyle }} />
  );
  return (
    <Col gap={hint === undefined ? 0 : 6}>
      {inset
        ? <InsetFrame field={field} leading={leading} trailing={trailing} background={colors.background} disabled={disabled}/>
        : <StackedFrame field={field} label={label} labelTrailing={labelTrailing} leading={leading} trailing={trailing} background={colors.background} disabled={disabled}/>}
      <FieldHint hint={hint} color={toneColor} />
    </Col>
  );
}
