import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Checkbox, type CheckboxProps } from '../src/react-native/checkbox';
import { bool, number, text, useDark } from './_controls';

export default { title: 'Checkbox' };

export const Controls: Story<CheckboxProps> = (args) => {
  const [checked, setChecked] = useState(args.checked ?? false);
  return <Checkbox {...args} dark={useDark()} checked={checked} onChange={setChecked} />;
};
Controls.args = { label: 'Accept the terms', checked: true, disabled: false, required: false, size: 20 };
Controls.argTypes = { label: text, checked: bool, disabled: bool, required: bool, size: number };
