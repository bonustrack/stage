import type { Story } from '../gallery/story';
import { Row, type FlexProps } from '../src/react-native/row';
import { Column } from '../src/react-native/column';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text } from './_controls';

export default { title: 'Row' };

const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
const SURFACE = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const;
const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;

function Cell({ label }: { label: string }): React.ReactElement {
  return <Column padding={8} background="#5b8def" radius="sm"><Text color="#ffffff">{label}</Text></Column>;
}

export const Controls: Story<FlexProps & { borderWidth: number; borderColor: string }> = ({ borderWidth, borderColor, ...args }) => {
  const side = { width: borderWidth, color: borderColor };
  return (
    <Row {...args} border={borderWidth > 0 ? { top: side, right: side, bottom: side, left: side } : undefined}>
      <Cell label="one" /><Cell label="two" /><Cell label="three" />
    </Row>
  );
};
Controls.args = { gap: 8, padding: 16, align: 'center', justify: 'start', wrap: false, surface: 'sunken', radius: 'md', width: '100%', height: 160, borderWidth: 0, borderColor: '#888888' };
Controls.argTypes = {
  gap: number, padding: number, margin: number, align: select(ALIGN), justify: select(JUSTIFY),
  weight: number, wrap: bool, surface: select(SURFACE), background: color, radius: select(RADII),
  width: text, height: text, minWidth: text, minHeight: text, maxWidth: text, maxHeight: text, aspectRatio: number,
  borderWidth: number, borderColor: color,
};

export const Justify: Story = () => (
  <Column gap={12}>
    {JUSTIFY.map((justify) => (
      <Row key={justify} justify={justify} surface="sunken" padding={8} radius="md" gap={8}>
        <Cell label={justify} /><Cell label="b" /><Cell label="c" />
      </Row>
    ))}
  </Column>
);

export const Weight: Story = () => (
  <Row gap={8} surface="sunken" padding={8} radius="md">
    <Column weight={1} padding={8} background="#57b375" radius="sm"><Text color="#ffffff">weight 1</Text></Column>
    <Column weight={2} padding={8} background="#9b6bd6" radius="sm"><Text color="#ffffff">weight 2</Text></Column>
  </Row>
);
