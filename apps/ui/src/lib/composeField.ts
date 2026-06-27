import type { Color, TextFieldNode } from '@stage-labs/kit/kit';
import { metroFieldColors, METRO_MONO_FAMILY } from './metroFieldColors';

export interface ComposeFieldOptions {
  name: string;
  value: string;
  placeholder?: string;
  fontSize: number;
  multiline?: boolean;
  rows?: number;
  minHeight?: number;
  mono?: boolean;
  textColor?: Color;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoCorrect?: boolean;
  inputMode?: 'text' | 'decimal' | 'numeric' | 'tel' | 'search' | 'email' | 'url' | 'none';
  changeType: string;
  submitType?: string;
}

export function composeField(options: ComposeFieldOptions): TextFieldNode {
  return {
    type: 'TextField',
    name: options.name,
    value: options.value,
    placeholder: options.placeholder,
    multiline: options.multiline,
    rows: options.rows,
    variant: 'outline',
    noFocusBorder: true,
    autoFocus: options.autoFocus,
    background: metroFieldColors.surface,
    borderColor: metroFieldColors.border,
    color: options.textColor ?? metroFieldColors.head,
    placeholderColor: metroFieldColors.sub,
    radius: 'sm',
    paddingX: 12,
    paddingY: 8,
    fontSize: options.fontSize,
    fontFamily: options.mono === true ? METRO_MONO_FAMILY : 'Calibre-Medium',
    minHeight: options.minHeight ?? 0,
    autoCapitalize: options.autoCapitalize,
    autoCorrect: options.autoCorrect,
    inputMode: options.inputMode,
    onChangeAction: { type: options.changeType },
    onSubmitAction: options.submitType === undefined ? undefined : { type: options.submitType },
  };
}
