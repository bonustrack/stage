import type { Story } from '../gallery/story';
import { Title, type TitleProps } from '../src/react-native/title';
import { Col } from '../src/react-native/box';
import { COLOR_TOKENS, select, text } from './_controls';

export default { title: 'Title' };

export const Controls: Story<TitleProps & { children: string }> = ({ children, ...args }) => <Title {...args}>{children}</Title>;
Controls.args = { children: 'Title', level: 2 };
Controls.argTypes = { children: text, level: select([1, 2, 3]), size: select(['sm', 'md', 'lg']), hero: select(['6xl', '7xl']), color: select(COLOR_TOKENS) };

export const Matrix: Story = () => (
  <Col gap={12}>
    <Title level={1}>Level 1</Title>
    <Title level={2}>Level 2</Title>
    <Title level={3}>Level 3</Title>
    <Title hero="6xl">Hero 6xl</Title>
    <Title hero="7xl">Hero 7xl</Title>
  </Col>
);
