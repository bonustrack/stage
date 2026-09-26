import type { Story } from '../gallery/story';
import { ListView, ListViewItem, type ListViewItemProps, type ListViewProps } from '../src/react-native/list-view';
import { Glyph } from '../src/react-native/glyph';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text, useDark } from './_controls';
import { IconPeople } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconPeople';

export default { title: 'List View' };

const ITEMS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon'];

export const Controls: Story<ListViewProps & Pick<ListViewItemProps, 'gap' | 'align' | 'showDivider' | 'pressedBackground'> & { statusText: string }> = ({ statusText, gap, align, showDivider, pressedBackground, ...args }) => {
  const dark = useDark();
  return (
    <ListView {...args} dark={dark} status={statusText ? { text: statusText } : undefined}>
      {ITEMS.map((label) => (
        <ListViewItem key={label} dark={dark} gap={gap} align={align} showDivider={showDivider} pressedBackground={pressedBackground} onPress={() => undefined}>
          <Glyph icon={IconPeople} size={20} dark={dark} />
          <Text>{label}</Text>
        </ListViewItem>
      ))}
    </ListView>
  );
};
Controls.args = { limit: 5, statusText: '', gap: 12, align: 'center', showDivider: true };
Controls.argTypes = { limit: number, statusText: text, gap: number, align: select(['start', 'center', 'end']), showDivider: bool, pressedBackground: color };
