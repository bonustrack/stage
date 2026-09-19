import type { Story } from '../gallery/story';
import { AudioPlayer, type AudioPlayerProps } from '../src/react-native/audio-player';
import { bool, color, number, range, silentWav, useDark } from './_controls';

export default { title: 'Audio Player' };

const SRC = silentWav(3);
const BARS = Array.from({ length: 40 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i / 3)));

export const Controls: Story<AudioPlayerProps> = (args) => <AudioPlayer {...args} dark={useDark()} src={SRC} bars={args.waveform ? BARS : undefined} />;
Controls.args = { src: SRC, duration: 3, waveform: true, barCount: 40 };
Controls.argTypes = { duration: number, waveform: bool, barCount: range(8, 80, 4), accent: color, onAccent: color };
