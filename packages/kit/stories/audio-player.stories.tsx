import type { Story } from '../gallery/story';
import { AudioPlayer, type AudioPlayerProps } from '../src/react-native/audio-player';
import { bool, color, number, range, silentWav, text, useDark } from './_controls';

export default { title: 'Audio Player' };

const URL = silentWav(3);
const BARS = Array.from({ length: 40 }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin(i / 3)));

export const Controls: Story<AudioPlayerProps> = (args) => (
  <AudioPlayer {...args} dark={useDark()} url={URL} bars={args.waveform ? BARS : undefined} />
);
Controls.args = { url: URL, description: 'Voice note', duration: 3, waveform: true, barCount: 40 };
Controls.argTypes = { description: text, duration: number, waveform: bool, barCount: range(8, 80, 4), accent: color, onAccent: color };
