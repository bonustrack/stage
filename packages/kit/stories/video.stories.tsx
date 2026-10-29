import type { Story } from '../gallery/story';
import { Video, type VideoProps } from '../src/react-native/video';
import { Column } from '../src/react-native/column';
import { bool, color, number, select, svgSwatch, text } from './_controls';

export default { title: 'Video' };

export const Controls: Story<VideoProps> = (args) => (
  <Column width={320}>
    <Video {...args} />
  </Column>
);
Controls.args = {
  url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
  posterUrl: svgSwatch('#3fb8c9', 'VID', 320, 180),
  controls: true,
  background: '#000000',
  aspectRatio: 16 / 9,
  fit: 'contain',
};
Controls.argTypes = {
  url: text,
  posterUrl: text,
  controls: bool,
  background: color,
  aspectRatio: number,
  fit: select(['contain', 'cover']),
};
