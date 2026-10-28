import type { Story } from '../gallery/story';
import { Column, type FlexProps } from '../src/react-native/column';
import { Row, type PressFeedback } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { Cell, FLEX_ARG_TYPES, SURFACES, select } from './_controls';

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

export const Clickable: Story<{ feedback: PressFeedback }> = ({ feedback }) => (
  <Row gap={12} wrap>
    {['Light', 'Dark', 'Sand'].map((name) => (
      <Column key={name} padding={12} radius={14} width={160} surface="sunken" feedback={feedback} accessibility={{ label: name }} onPress={() => undefined}>
        <Text fontWeight="semibold">{name}</Text>
      </Column>
    ))}
  </Row>
);
Clickable.args = { feedback: 'opacity' };
Clickable.argTypes = { feedback: select(['opacity', 'highlight', 'none']) };
