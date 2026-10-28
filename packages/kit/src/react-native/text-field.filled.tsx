import { forwardRef, type ReactNode } from 'react';
import type { TextInput, TextStyle } from 'react-native';
import { fontName, fontSize, type KitPalette } from '../tokens';
import { firstCheckMessage } from './a2ui-props';
import { Column } from './column';
import { Row } from './row';
import { Text } from './text';
import { AreaField, InputField } from './text-field.input';
import type { TextFieldHintTone, TextFieldProps } from './text-field.types';
import { useKitPalette } from './theme-context';

export const FORM_FIELD_RADIUS = 4;

const FIELD_PADDING_X = 16;
const FIELD_PADDING_TOP = 8;
const FIELD_PADDING_BOTTOM = 12;
const TRAILING_SLOT = 24;
const LEADING_SLOT = 20;
const SLOT_GAP = 8;
const MULTILINE_ROW_HEIGHT = 26;

export const FORM_FIELD_HEIGHT = FIELD_PADDING_TOP + TRAILING_SLOT + FIELD_PADDING_BOTTOM;

const BARE_INPUT: TextStyle = {
  backgroundColor: 'transparent', borderWidth: 0, borderRadius: 0,
  paddingHorizontal: 0, paddingVertical: 0, minHeight: 0,
};
const CENTERED_LINE: TextStyle = { includeFontPadding: false, textAlignVertical: 'center' };
const SLOT = { position: 'absolute', top: 0, bottom: 0 } as const;
const DISABLED = { opacity: 0.6 };

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

function slotInset(slot: ReactNode, width: number): number {
  return FIELD_PADDING_X + (slot === undefined ? 0 : width + SLOT_GAP);
}

function lineStyle(props: TextFieldProps, inset: boolean): TextStyle {
  if (!inset) return { flex: 1 };
  return {
    ...CENTERED_LINE, height: FORM_FIELD_HEIGHT,
    paddingLeft: slotInset(props.leading, LEADING_SLOT), paddingRight: slotInset(props.trailing, props.trailingWidth ?? TRAILING_SLOT),
  };
}

function InsetFrame({ field, props, background }: { field: ReactNode; props: TextFieldProps; background: string }): React.ReactElement {
  return (
    <Column background={background} radius={FORM_FIELD_RADIUS} style={props.disabled === true ? DISABLED : undefined}>
      {field}
      {props.leading === undefined ? null : (
        <Row pointerEvents="none" align="center" justify="center" width={LEADING_SLOT} style={[SLOT, { left: FIELD_PADDING_X }]}>{props.leading}</Row>
      )}
      {props.trailing === undefined ? null : (
        <Row pointerEvents="box-none" align="center" style={[SLOT, { right: FIELD_PADDING_X }]}>{props.trailing}</Row>
      )}
    </Column>
  );
}

function StackedFrame({ field, props, background }: { field: ReactNode; props: TextFieldProps; background: string }): React.ReactElement {
  return (
    <Column background={background} radius={FORM_FIELD_RADIUS} padding={{ x: FIELD_PADDING_X, top: FIELD_PADDING_TOP, bottom: FIELD_PADDING_BOTTOM }} gap={2}
      style={props.disabled === true ? DISABLED : undefined}>
      {props.label === undefined ? null : (
        <Row align="center" gap={6}>
          <Text text={props.label} size="xs" color="secondary" />
          {props.labelTrailing}
        </Row>
      )}
      <Row align="center" gap={8} minHeight={TRAILING_SLOT}>
        {props.leading}
        {field}
        {props.trailing === undefined ? null : <Row align="center" height={TRAILING_SLOT} style={{ flexShrink: 0 }}>{props.trailing}</Row>}
      </Row>
    </Column>
  );
}

export const FilledField = forwardRef<TextInput, TextFieldProps>(function FilledField(props, ref) {
  const palette = useKitPalette();
  const { hint, color } = resolveHint(props, palette);
  const rows = props.rows ?? 3;
  const multiline = props.variant === 'longText';
  const inset = props.label === undefined && !multiline;
  const textStyle: TextStyle = { color: palette.link, fontFamily: fontName.sans, fontSize: fontSize('md') };
  const inner: TextFieldProps = {
    ...props, label: undefined, weight: undefined, appearance: 'soft', placeholderTextColor: props.placeholderTextColor ?? palette.sub, rows,
  };
  const field = multiline
    ? <AreaField {...inner} ref={ref} style={{ ...BARE_INPUT, ...textStyle, flex: 1, textAlignVertical: 'top', height: undefined, minHeight: rows * MULTILINE_ROW_HEIGHT }} />
    : <InputField {...inner} ref={ref} style={{ ...BARE_INPUT, ...textStyle, ...lineStyle(props, inset) }} />;
  return (
    <Column gap={hint === undefined ? 0 : 6} weight={props.weight}>
      {inset ? <InsetFrame field={field} props={props} background={palette.border}/> : <StackedFrame field={field} props={props} background={palette.border}/>}
      {hint === undefined ? null : <Text text={hint} size="xs" color={color} style={{ paddingHorizontal: 4 }} />}
    </Column>
  );
});
