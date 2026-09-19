import type { Story } from '../gallery/story';
import { AvatarStack, type AvatarStackProps } from '../src/react-native/avatar-stack';
import { color, number, range, svgSwatch, SWATCHES, useDark } from './_controls';

export default { title: 'Avatar Stack' };

const ITEMS = SWATCHES.map((c, i) => (i % 3 === 2 ? { fallback: String.fromCharCode(65 + i) } : { src: svgSwatch(c, String.fromCharCode(65 + i)) }));

export const Controls: Story<AvatarStackProps> = (args) => <AvatarStack {...args} dark={useDark()} items={ITEMS} />;
Controls.args = { size: 32, max: 4, overlap: 10 };
Controls.argTypes = {
  size: range(16, 96, 4), max: range(1, 6), overlap: range(0, 32), ring: color, fallbackBackground: color, moreBackground: color, moreColor: color, moreFontSize: number,
};
