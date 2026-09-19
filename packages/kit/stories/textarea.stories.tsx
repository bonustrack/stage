import type { Story } from '../gallery/story';
import { Textarea, type TextareaProps } from '../src/react-native/textarea';
import { bool, color, CONTROL_SIZES, CONTROL_VARIANTS, number, select, text, useDark } from './_controls';

export default { title: 'Textarea' };

export const Controls: Story<TextareaProps> = (args) => <Textarea dark={useDark()} {...args} />;
Controls.args = { placeholder: 'Write something longer', variant: 'soft', size: 'md', rows: 3, autoResize: true, disabled: false };
Controls.argTypes = {
  placeholder: text, defaultValue: text, variant: select(CONTROL_VARIANTS), size: select(CONTROL_SIZES), rows: number, maxRows: number,
  autoResize: bool, disabled: bool, required: bool, autoFocus: bool, autoSelect: bool, radius: number, placeholderTextColor: color,
};
