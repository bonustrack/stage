import type { Story } from '../gallery/story';
import { Divider, type DividerProps } from '../src/react-native/divider';
import { Col } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { color, number, useDark } from './_controls';

export default { title: 'Divider' };

export const Controls: Story<DividerProps> = (args) => (
  <Col>
    <Text>Above</Text>
    <Divider {...args} dark={useDark()} />
    <Text>Below</Text>
  </Col>
);
Controls.args = { spacing: 12, size: 1 };
Controls.argTypes = { spacing: number, size: number, color, flush: number };
