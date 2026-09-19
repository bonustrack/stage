import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Switch, type SwitchProps } from '../src/react-native/switch';
import { bool, text, useDark } from './_controls';

export default { title: 'Switch' };

export const Controls: Story<SwitchProps> = (args) => {
  const [checked, setChecked] = useState(args.checked);
  return <Switch {...args} dark={useDark()} checked={checked} onChange={setChecked} />;
};
Controls.args = { checked: true, label: 'Notifications', disabled: false };
Controls.argTypes = { checked: bool, label: text, disabled: bool };
