import type { Story } from '../gallery/story';
import { FlatList } from '../src/react-native/flat-list';
import { Box } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, number, range } from './_controls';

export default { title: 'Flat List' };

const DATA = Array.from({ length: 40 }, (_, i) => ({ id: String(i), label: `Row ${i + 1}` }));

export const Controls: Story<{ count: number; horizontal: boolean; inverted: boolean; numColumns: number; gap: number }> = ({ count, gap, ...args }) => (
  <Box height={320} surface="sunken" radius="md">
    <FlatList
      {...args}
      key={`${args.numColumns}-${args.horizontal}`}
      data={DATA.slice(0, count)}
      keyExtractor={(item) => item.id}
      contentContainerStyle={{ padding: 12, gap }}
      renderItem={({ item }) => <Box padding={12} background="#5b8def" radius="sm" flex={1}><Text color="#fff">{item.label}</Text></Box>}
    />
  </Box>
);
Controls.args = { count: 40, horizontal: false, inverted: false, numColumns: 1, gap: 8 };
Controls.argTypes = { count: range(0, 40), horizontal: bool, inverted: bool, numColumns: range(1, 4), gap: number };
