import type { Story } from '../gallery/story';
import { Row, type FlexProps } from '../src/react-native/row';
import { Column } from '../src/react-native/column';
import { Text } from '../src/react-native/text';
import { Cell, color, FLEX_ARG_TYPES, JUSTIFY, number } from './_controls';

export default { title: 'Row' };

const BLUE = '#5b8def';

export const Controls: Story<FlexProps & { borderWidth: number; borderColor: string }> = ({ borderWidth, borderColor, ...args }) => {
  const side = { width: borderWidth, color: borderColor };
  return (
    <Row {...args} border={borderWidth > 0 ? { top: side, right: side, bottom: side, left: side } : undefined}>
      <Cell label="one" background={BLUE} />
      <Cell label="two" background={BLUE} />
      <Cell label="three" background={BLUE} />
    </Row>
  );
};
Controls.args = {
  gap: 8,
  padding: 16,
  align: 'center',
  justify: 'start',
  wrap: false,
  surface: 'sunken',
  radius: 'md',
  width: '100%',
  height: 160,
  borderWidth: 0,
  borderColor: '#888888',
};
Controls.argTypes = { ...FLEX_ARG_TYPES, borderWidth: number, borderColor: color };

export const Justify: Story = () => (
  <Column gap={12}>
    {JUSTIFY.map((justify) => (
      <Row key={justify} justify={justify} surface="sunken" padding={8} radius="md" gap={8}>
        <Cell label={justify} background={BLUE} />
        <Cell label="b" background={BLUE} />
        <Cell label="c" background={BLUE} />
      </Row>
    ))}
  </Column>
);

export const Weight: Story = () => (
  <Row gap={8} surface="sunken" padding={8} radius="md">
    <Column weight={1} padding={8} background="#57b375" radius="sm">
      <Text color="#ffffff">weight 1</Text>
    </Column>
    <Column weight={2} padding={8} background="#9b6bd6" radius="sm">
      <Text color="#ffffff">weight 2</Text>
    </Column>
  </Row>
);
