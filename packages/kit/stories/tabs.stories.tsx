import type { Story } from '../gallery/story';
import { Tabs, type TabItem, type TabsProps } from '../src/react-native/tabs';
import { Text } from '../src/react-native/text';
import { bool, number, select, useDark } from './_controls';

export default { title: 'Tabs' };

const TABS: TabItem[] = [
  { title: 'Chats', icon: 'chatBubble', child: <Text text="Your conversations." /> },
  { title: 'Contacts', icon: 'users', child: <Text text="People you talk to." /> },
  { title: 'Wallet', icon: 'creditCard', child: <Text text="Balances and transfers." /> },
];

export const Controls: Story<Omit<TabsProps, 'tabs'> & { icons: boolean }> = ({ icons, ...args }) => (
  <Tabs {...args} dark={useDark()} tabs={icons ? TABS : TABS.map(({ title, child }) => ({ title, child }))} />
);
Controls.args = { defaultIndex: 0, variant: 'segmented', icons: true };
Controls.argTypes = { defaultIndex: number, variant: select(['segmented', 'underline']), icons: bool };
