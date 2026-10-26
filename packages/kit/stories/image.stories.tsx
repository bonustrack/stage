import type { Story } from '../gallery/story';
import { Image, type ImageProps } from '../src/react-native/image';
import { Column } from '../src/react-native/column';
import { Row } from '../src/react-native/row';
import { Text } from '../src/react-native/text';
import { bool, color, number, RADII, select, svgSwatch, text } from './_controls';

export default { title: 'Image' };

const FIT = ['contain', 'cover', 'fill', 'none', 'scaleDown'] as const;
const VARIANTS = ['icon', 'avatar', 'smallFeature', 'mediumFeature', 'largeFeature', 'header'] as const;
const POSITION = ['center', 'top', 'bottom', 'left', 'right', 'top left', 'top right', 'bottom left', 'bottom right'] as const;
const URL = svgSwatch('#5b8def', 'IMG');

export const Controls: Story<ImageProps> = (args) => <Image {...args} />;
Controls.args = { url: URL, description: 'Blue swatch', fit: 'cover', position: 'center', frame: false, radius: 'md', size: 160 };
Controls.argTypes = {
  url: text, description: text, fit: select(FIT), variant: select(VARIANTS), position: select(POSITION), frame: bool, flush: number,
  radius: select(RADII), size: number, aspectRatio: number, width: text, height: text, background: color, margin: number,
};

export const Variants: Story = () => (
  <Column gap={12} width={360}>
    {VARIANTS.map((v) => (
      <Column key={v} gap={4}>
        <Text variant="caption" text={v} />
        <Image url={svgSwatch('#57b375', v.slice(0, 3))} variant={v} fit="cover" description={v} />
      </Column>
    ))}
  </Column>
);

export const Radii: Story = () => (
  <Row gap={8} wrap>{RADII.map((r) => <Image key={r} url={svgSwatch('#9b6bd6', r)} radius={r} size={72} description={r} />)}</Row>
);

export const Placeholder: Story = () => <Image url="" variant="avatar" background="#282a2d" />;
