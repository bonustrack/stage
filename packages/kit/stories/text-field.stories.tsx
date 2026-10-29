import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Column } from '../src/react-native/column';
import { TextField, type TextFieldProps } from '../src/react-native/text-field';
import { bool, color, CONTROL_SIZES, number, select, text, useDark } from './_controls';

export default { title: 'Text Field' };

const VARIANTS = ['shortText', 'longText', 'number', 'obscured'] as const;
const APPEARANCES = ['soft', 'outline', 'plain'] as const;

export const Controls: Story<TextFieldProps> = (args) => {
  const [value, setValue] = useState(args.value ?? '');
  return <TextField {...args} dark={useDark()} value={value} onChangeText={setValue} />;
};
Controls.args = {
  label: 'Display name',
  value: '',
  placeholder: 'Type here',
  variant: 'shortText',
  appearance: 'soft',
  size: 'md',
  disabled: false,
  hint: 'Shown to your contacts',
};
Controls.argTypes = {
  label: text,
  placeholder: text,
  variant: select(VARIANTS),
  appearance: select(APPEARANCES),
  size: select(CONTROL_SIZES),
  inputType: select(['text', 'email', 'tel', 'url']),
  pill: bool,
  radius: number,
  disabled: bool,
  autoFocus: bool,
  autoSelect: bool,
  rows: number,
  maxRows: number,
  autoResize: bool,
  autoGrow: bool,
  minHeight: number,
  maxHeight: number,
  hint: text,
  hintTone: select(['secondary', 'success', 'danger']),
  hintColor: color,
  background: color,
  borderColor: color,
  color,
  placeholderColor: color,
  paddingX: number,
  paddingY: number,
  lineHeight: number,
  fontSize: number,
  maxLength: number,
  autoCapitalize: select(['none', 'sentences', 'words', 'characters']),
  autoCorrect: bool,
  inputMode: select(['text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url', 'none']),
  returnKeyType: select(['done', 'go', 'next', 'search', 'send', 'default']),
};

export const Matrix: Story = () => {
  const dark = useDark();
  return (
    <Column gap={12}>
      {APPEARANCES.flatMap((appearance) =>
        VARIANTS.map((variant) => (
          <TextField
            key={`${appearance}-${variant}`}
            dark={dark}
            appearance={appearance}
            variant={variant}
            placeholder={`${appearance} / ${variant}`}
          />
        )),
      )}
      <TextField dark={dark} label="Email" value="nope" checks={[{ valid: false, message: 'Must be a valid email address.' }]} />
    </Column>
  );
};
