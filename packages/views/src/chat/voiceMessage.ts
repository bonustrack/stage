import type { AudioPlayerNode, Color, RowNode } from '@stage-labs/kit/kit';
import { compact } from '../node';
import { VOICE_PLAY } from '../actions';
import { VOICE_ACCENT, VOICE_ON_ACCENT } from '../colors';

export interface VoiceMessageParams {
  src: string;
  duration?: number;
  background?: Color;
  onAccent?: Color;
  bars?: number[];
  barCount?: number;
}

export function voiceMessage(params: VoiceMessageParams): RowNode {
  const background = params.background ?? VOICE_ACCENT;
  const player = compact<AudioPlayerNode>({
    type: 'AudioPlayer',
    src: params.src,
    duration: params.duration,
    waveform: true,
    bars: params.bars,
    barCount: params.barCount,
    accent: background,
    onAccent: params.onAccent ?? VOICE_ON_ACCENT,
    onPlayAction: { type: VOICE_PLAY, payload: { src: params.src } },
  });
  return {
    type: 'Row',
    radius: '2xl',
    background,
    maxWidth: 280,
    minWidth: 200,
    padding: { x: 9, y: 7 },
    align: 'center',
    children: [player],
  };
}
