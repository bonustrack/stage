import type { Story } from '../gallery/story';
import { Image, type ImageProps } from '../src/react-native/image';
import { Row } from '../src/react-native/box';
import { bool, color, number, select, svgSwatch, text } from './_controls';

export default { title: 'Image' };

const FIT = ['none', 'cover', 'contain', 'fill', 'scale-down'] as const;
const POSITION = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'] as const;
const RADII = ['none', '2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', 'full'] as const;
const SRC = svgSwatch('#5b8def', 'IMG');

export const Controls: Story<ImageProps> = (args) => <Image {...args} />;
Controls.args = { src: SRC, alt: 'Blue swatch', fit: 'cover', position: 'center', frame: false, radius: 'md', size: 160 };
Controls.argTypes = {
  src: text, alt: text, fit: select(FIT), position: select(POSITION), frame: bool, flush: number, radius: select(RADII),
  size: number, aspectRatio: number, width: text, height: text, background: color, margin: number,
};

export const Radii: Story = () => (
  <Row gap={8} wrap>{RADII.map((r) => <Image key={r} src={svgSwatch('#9b6bd6', r)} radius={r} size={72} alt={r} />)}</Row>
);
