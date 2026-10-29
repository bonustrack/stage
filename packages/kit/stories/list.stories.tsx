import type { Story } from '../gallery/story';
import { List, type ListProps } from '../src/react-native/list';
import { Badge } from '../src/react-native/badge';
import { number, select, useDark } from './_controls';

export default { title: 'List' };

const ITEMS = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta', 'Theta'];

export const Controls: Story<ListProps> = (args) => {
  const dark = useDark();
  return (
    <List {...args}>
      {ITEMS.map((label) => (
        <Badge key={label} dark={dark} label={label} size="lg" pill />
      ))}
    </List>
  );
};
Controls.args = { direction: 'horizontal', align: 'start', gap: 8, padding: 4 };
Controls.argTypes = {
  direction: select(['vertical', 'horizontal']),
  align: select(['start', 'center', 'end', 'stretch']),
  gap: number,
  padding: number,
  weight: number,
};
