import type { Story } from '../gallery/story';
import { Column, type FlexProps } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { Cell, FLEX_ARG_TYPES, SURFACES } from './_controls';

export default { title: 'Column' };

const RED = '#e06c75';

export const Controls: Story<FlexProps> = (args) => (
  <Column {...args}>
    <Cell label="one" background={RED} /><Cell label="two" background={RED} /><Cell label="three" background={RED} />
  </Column>
);
Controls.args = { gap: 8, padding: 16, align: 'stretch', justify: 'start', wrap: false, surface: 'sunken', radius: 'md', width: 240, height: 220 };
Controls.argTypes = FLEX_ARG_TYPES;

export const Surfaces: Story = () => (
  <Row gap={8} wrap>
    {SURFACES.map((surface) => <Column key={surface} surface={surface} padding={12} radius="md"><Text>{surface}</Text></Column>)}
  </Row>
);
