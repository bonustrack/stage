import type { Story } from '../gallery/story';
import { Divider, type DividerProps } from '../src/react-native/divider';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { color, number, select, useDark } from './_controls';

export default { title: 'Divider' };

export const Controls: Story<DividerProps> = (args) => {
  const dark = useDark();
  if (args.axis === 'vertical') {
    return (
      <Row height={40} align="center">
        <Text>Left</Text>
        <Divider {...args} dark={dark} />
        <Text>Right</Text>
      </Row>
    );
  }
  return (
    <Column>
      <Text>Above</Text>
      <Divider {...args} dark={dark} />
      <Text>Below</Text>
    </Column>
  );
};
Controls.args = { axis: 'horizontal', spacing: 12, size: 1 };
Controls.argTypes = { axis: select(['horizontal', 'vertical']), spacing: number, size: number, color, flush: number };
