import type { Story } from '../gallery/story';
import { Box, Col, Row, type BoxProps } from '../src/react-native/box';
import { Text } from '../src/react-native/text';
import { bool, color, number, select, text } from './_controls';

export default { title: 'Box' };

const ALIGN = ['start', 'center', 'end', 'stretch', 'baseline'] as const;
const JUSTIFY = ['start', 'center', 'end', 'between', 'around', 'evenly'] as const;
const SURFACE = ['none', 'surface', 'raised', 'sunken', 'toolbar'] as const;
const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;

function Cell({ label }: { label: string }): React.ReactElement {
  return <Box padding={8} background="#5b8def" radius="sm"><Text color="#fff">{label}</Text></Box>;
}

export const Controls: Story<BoxProps & { borderWidth: number; borderColor: string }> = ({ borderWidth, borderColor, ...args }) => {
  const side = { width: borderWidth, color: borderColor };
  return (
    <Box {...args} border={borderWidth > 0 ? { top: side, right: side, bottom: side, left: side } : undefined}>
      <Cell label="one" /><Cell label="two" /><Cell label="three" />
    </Box>
  );
};
Controls.args = { direction: 'row', gap: 8, padding: 16, align: 'center', justify: 'start', wrap: false, surface: 'sunken', radius: 'md', width: '100%', height: 160, borderWidth: 0, borderColor: '#888888' };
Controls.argTypes = {
  direction: select(['row', 'col']), gap: number, padding: number, margin: number, align: select(ALIGN), justify: select(JUSTIFY),
  flex: number, wrap: bool, surface: select(SURFACE), background: color, radius: select(RADII),
  width: text, height: text, minWidth: text, minHeight: text, maxWidth: text, maxHeight: text, aspectRatio: number,
  borderWidth: number, borderColor: color,
};

export const RowAndCol: Story = () => (
  <Col gap={16}>
    <Row gap={8}><Cell label="Row" /><Cell label="a" /><Cell label="b" /></Row>
    <Col gap={8} width={160}><Cell label="Col" /><Cell label="a" /><Cell label="b" /></Col>
    <Row gap={8}>{SURFACE.map((s) => <Box key={s} surface={s} padding={12} radius="md"><Text>{s}</Text></Box>)}</Row>
  </Col>
);
