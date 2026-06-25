import type { BoxNode } from '@stage-labs/kit/kit';
import view from './videoMessage.json';
import { buildView } from '../buildView';

export interface VideoMessageParams {
  src: string;
  poster?: string;
  width?: number;
}

export function videoMessage(params: VideoMessageParams): BoxNode {
  return buildView(view, {
    src: params.src,
    poster: params.poster,
    width: params.width ?? 220,
  }) as BoxNode;
}
