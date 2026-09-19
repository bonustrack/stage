import type { Story } from '../gallery/story';
import { AvatarView, type AvatarViewProps } from '../src/react-native/avatar.view';
import { Row } from '../src/react-native/box';
import { bool, color, select, svgSwatch, text } from './_controls';

export default { title: 'Avatar View' };

const SRC = svgSwatch('#57b375', 'A');

export const Controls: Story<AvatarViewProps> = (args) => <AvatarView {...args} />;
Controls.args = { src: SRC, size: 'md', square: false, alt: 'Avatar' };
Controls.argTypes = { src: text, size: select(['sm', 'md', 'lg']), square: bool, alt: text, placeholderColor: color };

export const Sizes: Story = () => (
  <Row gap={12} align="center">
    <AvatarView src={SRC} size="sm" /><AvatarView src={SRC} size="md" /><AvatarView src={SRC} size="lg" /><AvatarView src={SRC} size={96} square />
    <AvatarView src={null} size="lg" placeholderColor="#9b6bd6" />
  </Row>
);
