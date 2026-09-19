import { useState } from 'react';
import type { Story } from '../gallery/story';
import { TextField, type TextFieldProps } from '../src/react-native/text-field';
import { bool, color, number, select, text, useDark } from './_controls';

export default { title: 'Text Field' };

export const Controls: Story<TextFieldProps> = (args) => {
  const [value, setValue] = useState(args.value);
  return <TextField {...args} dark={useDark()} value={value} onChangeText={setValue} />;
};
Controls.args = { value: '', placeholder: 'Message', multiline: true, rows: 1, autoGrow: true, variant: 'outline', disabled: false };
Controls.argTypes = {
  placeholder: text, multiline: bool, rows: number, autoGrow: bool, autoFocus: bool, disabled: bool, variant: select(['outline', 'plain']),
  background: color, borderColor: color, color, placeholderColor: color, radius: number, paddingX: number, paddingY: number,
  lineHeight: number, fontSize: number, maxLength: number, maxHeight: number, minHeight: number,
  autoCapitalize: select(['none', 'sentences', 'words', 'characters']), autoCorrect: bool,
  inputMode: select(['text', 'decimal', 'numeric', 'tel', 'search', 'email', 'url', 'none']),
  returnKeyType: select(['done', 'go', 'next', 'search', 'send', 'default']),
};
