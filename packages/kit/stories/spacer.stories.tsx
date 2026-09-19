import type { Story } from '../gallery/story';
import { Spacer, type SpacerProps } from '../src/react-native/spacer';
import { Box, Row } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { number, text } from './_controls';

export default { title: 'Spacer' };

export const Controls: Story<SpacerProps> = (args) => (
  <Row surface="sunken" padding={8} radius="md">
    <Box padding={8} background="#5b8def" radius="sm"><Text color="#fff">left</Text></Box>
    <Spacer {...args} />
    <Box padding={8} background="#e06c75" radius="sm"><Text color="#fff">right</Text></Box>
  </Row>
);
Controls.args = { flex: 1 };
Controls.argTypes = { flex: number, minSize: text };
