import { useState } from 'react';
import type { Story } from '../gallery/story';
import { Tabs, type TabsProps } from '../src/react-native/tabs';
import { bool, select, useDark } from './_controls';
import { IconBubble3 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconBubble3';
import { IconGroup1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconGroup1';
import { IconCreditCard1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconCreditCard1';

export default { title: 'Tabs' };

const OPTIONS = [
  { value: 'chats', label: 'Chats', icon: IconBubble3 },
  { value: 'contacts', label: 'Contacts', icon: IconGroup1 },
  { value: 'wallet', label: 'Wallet', icon: IconCreditCard1 },
];

export const Controls: Story<TabsProps & { icons: boolean }> = ({ icons, ...args }) => {
  const [value, setValue] = useState(args.value);
  return <Tabs {...args} dark={useDark()} value={value} onChange={setValue} options={icons ? OPTIONS : OPTIONS.map((o) => ({ value: o.value, label: o.label }))} />;
};
Controls.args = { value: 'chats', variant: 'segmented', icons: true };
Controls.argTypes = { variant: select(['segmented', 'underline']), icons: bool };
