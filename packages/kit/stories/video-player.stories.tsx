import type { Story } from '../gallery/story';
import { VideoPlayer, type VideoPlayerProps } from '../src/react-native/video-player';
import { Box } from '../src/react-native/box';
import { bool, svgSwatch, text } from './_controls';

export default { title: 'Video Player' };

export const Controls: Story<VideoPlayerProps> = (args) => <Box width={320} height={180}><VideoPlayer {...args} /></Box>;
Controls.args = { src: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4', poster: svgSwatch('#3fb8c9', 'VID'), controls: true };
Controls.argTypes = { src: text, poster: text, controls: bool };
