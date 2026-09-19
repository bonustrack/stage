import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Tabs, type TabsProps } from '../src/react-native/tabs';
import { bool, select, useDark } from './_controls';

export default { title: 'Tabs' };

const OPTIONS = [
  { value: 'chats', label: 'Chats', icon: 'chatBubble' as const },
  { value: 'contacts', label: 'Contacts', icon: 'users' as const },
  { value: 'wallet', label: 'Wallet', icon: 'creditCard' as const },
];

export const Controls: Story<TabsProps & { icons: boolean }> = ({ icons, ...args }) => {
  const [value, setValue] = useState(args.value);
  return <Tabs {...args} dark={useDark()} value={value} onChange={setValue} options={icons ? OPTIONS : OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />;
};
Controls.args = { value: 'chats', variant: 'segmented', icons: true };
Controls.argTypes = { variant: select(['segmented', 'underline']), icons: bool };
