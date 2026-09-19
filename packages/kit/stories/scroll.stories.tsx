import type { Story } from '../gallery/story';
import { Scroll, type ScrollProps } from '../src/react-native/scroll';
import { Box } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, number, SWATCHES } from './_controls';

export default { title: 'Scroll' };

export const Controls: Story<ScrollProps> = (args) => (
  <Box height={args.horizontal ? undefined : 200} width={args.horizontal ? 320 : undefined} surface="sunken" radius="md">
    <Scroll {...args}>
      {Array.from({ length: 12 }, (_, i) => (
        <Box key={i} padding={16} background={SWATCHES[i % SWATCHES.length]} radius="sm" minWidth={120}><Text color="#fff">Item {i + 1}</Text></Box>
      ))}
    </Scroll>
  </Box>
);
Controls.args = { horizontal: false, padding: 12, gap: 8, showsVerticalScrollIndicator: true };
Controls.argTypes = { horizontal: bool, padding: number, gap: number, showsVerticalScrollIndicator: bool, showsHorizontalScrollIndicator: bool };
