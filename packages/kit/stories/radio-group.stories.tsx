import { useState } from 'react';
import type { Story } from '../gallery/story';
import { RadioGroup, type RadioGroupProps } from '../src/react-native/radio-group';
import { bool, number, select, useDark } from './_controls';

export default { title: 'Radio Group' };

const OPTIONS = [
  { label: 'Small', value: 'sm' }, { label: 'Medium', value: 'md' }, { label: 'Large', value: 'lg' }, { label: 'Disabled', value: 'x', disabled: true },
];

export const Controls: Story<RadioGroupProps> = (args) => {
  const [value, setValue] = useState(args.value ?? 'md');
  return <RadioGroup {...args} dark={useDark()} options={OPTIONS} value={value} onChange={setValue} />;
};
Controls.args = { direction: 'col', disabled: false, required: false, size: 20 };
Controls.argTypes = { direction: select(['row', 'col']), disabled: bool, required: bool, size: number };
