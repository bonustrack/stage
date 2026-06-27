import type { BoxNode, WidgetNode } from '@stage-labs/kit/kit';
import { compact } from '../node';

const VIDEO_LETTERBOX_FIXED = '#000';

export interface VideoMessageParams {
  src: string;
  poster?: string;
  width?: number;
}

export function videoMessage(params: VideoMessageParams): BoxNode {
  const player: WidgetNode = compact({
    type: 'VideoPlayer' as const,
    src: params.src,
    poster: params.poster,
    controls: true,
  });
  return {
    type: 'Box',
    width: params.width ?? 220,
    radius: 'md',
    background: VIDEO_LETTERBOX_FIXED,
    children: [player],
  };
}
