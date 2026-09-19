import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Select, type SelectProps } from '../src/react-native/select';
import { bool, CONTROL_SIZES, CONTROL_VARIANTS, number, select, text, useDark } from './_controls';

export default { title: 'Select' };

const OPTIONS = [{ label: 'Apple', value: 'apple' }, { label: 'Banana', value: 'banana' }, { label: 'Cherry', value: 'cherry' }];

export const Controls: Story<SelectProps> = (args) => {
  const [value, setValue] = useState(args.value ?? '');
  return <Select {...args} dark={useDark()} options={OPTIONS} value={value} onChange={setValue} />;
};
Controls.args = { placeholder: 'Pick a fruit', variant: 'soft', size: 'md', pill: false, block: false, clearable: true, disabled: false };
Controls.argTypes = {
  placeholder: text, variant: select(CONTROL_VARIANTS), size: select(CONTROL_SIZES), pill: bool, block: bool, clearable: bool, disabled: bool, radius: number,
};
