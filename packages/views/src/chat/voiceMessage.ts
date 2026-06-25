import type { Color, RowNode } from '@stage-labs/kit/kit';
import view from './voiceMessage.json';
import { buildView } from '../buildView';
import { VOICE_PLAY } from '../actions';

export interface VoiceMessageParams {
  src: string;
  duration?: number;
  background?: Color;
}

export function voiceMessage(params: VoiceMessageParams): RowNode {
  return buildView(view, {
    src: params.src,
    duration: params.duration,
    background: params.background ?? '#0a7cff',
    playType: VOICE_PLAY,
  }) as RowNode;
}
