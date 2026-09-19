import type { Story } from '../gallery/story';
import { Input, type InputProps } from '../src/react-native/input';
import { Col } from '../src/react-native/box';
import { bool, color, CONTROL_SIZES, CONTROL_VARIANTS, number, select, text, useDark } from './_controls';

export default { title: 'Input' };

const TYPES = ['text', 'email', 'password', 'number', 'tel', 'url'] as const;

export const Controls: Story<InputProps> = (args) => <Input dark={useDark()} {...args} />;
Controls.args = { placeholder: 'Type here', variant: 'soft', size: 'md', inputType: 'text', pill: false, disabled: false, required: false, autoFocus: false };
Controls.argTypes = {
  placeholder: text, defaultValue: text, variant: select(CONTROL_VARIANTS), size: select(CONTROL_SIZES), inputType: select(TYPES),
  pill: bool, disabled: bool, required: bool, autoFocus: bool, autoSelect: bool, pattern: text, radius: number, placeholderTextColor: color,
};

export const Sizes: Story = () => {
  const dark = useDark();
  return <Col gap={8}>{CONTROL_SIZES.map((s) => <Input key={s} dark={dark} size={s} placeholder={s} />)}</Col>;
};
