import type { Story } from '../gallery/story';
import { Column, type FlexProps } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text } from './_controls';

export default { title: 'Column' };

const ALIGN = ['start', 'center', 'end', 'stretch'] as const;
const JUSTIFY = ['start', 'center', 'end', 'spaceBetween', 'spaceAround', 'spaceEvenly', 'stretch'] as const;
const SURFACE = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const;
const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;

function Cell({ label }: { label: string }): React.ReactElement {
  return <Column padding={8} background="#e06c75" radius="sm"><Text color="#ffffff">{label}</Text></Column>;
}

export const Controls: Story<FlexProps> = (args) => (
  <Column {...args}>
    <Cell label="one" /><Cell label="two" /><Cell label="three" />
  </Column>
);
Controls.args = { gap: 8, padding: 16, align: 'stretch', justify: 'start', wrap: false, surface: 'sunken', radius: 'md', width: 240, height: 220 };
Controls.argTypes = {
  gap: number, padding: number, margin: number, align: select(ALIGN), justify: select(JUSTIFY),
  weight: number, wrap: bool, surface: select(SURFACE), background: color, radius: select(RADII),
  width: text, height: text, minWidth: text, minHeight: text, maxWidth: text, maxHeight: text, aspectRatio: number,
};

export const Surfaces: Story = () => (
  <Row gap={8} wrap>
    {SURFACE.map((surface) => <Column key={surface} surface={surface} padding={12} radius="md"><Text>{surface}</Text></Column>)}
  </Row>
);
