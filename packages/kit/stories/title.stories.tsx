import type { Story } from '../gallery/story';
import { Title, type TitleProps } from '../src/react-native/title';
import { Column } from '../src/react-native/column';
import { COLOR_TOKENS, select, text } from './_controls';

export default { title: 'Title' };

export const Controls: Story<TitleProps> = (args) => <Title {...args} />;
Controls.args = { text: 'Title', level: 2 };
Controls.argTypes = { text, level: select([1, 2, 3]), size: select(['sm', 'md', 'lg']), hero: select(['3xl', '4xl']), color: select(COLOR_TOKENS) };

export const Matrix: Story = () => (
  <Column gap={12}>
    <Title level={1} text="Level 1" />
    <Title level={2} text="Level 2" />
    <Title level={3} text="Level 3" />
    <Title hero="3xl" text="Hero 3xl" />
    <Title hero="4xl" text="Hero 4xl" />
  </Column>
);
