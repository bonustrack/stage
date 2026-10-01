import { useCallback, useState } from 'react';
import type { VideoSize } from '@stage-labs/kit/react-native/video-player';
import { VIDEO_PLACEHOLDER_RATIO, mediaAspectRatio } from './bubble/imageBox.model';

const KNOWN_RATIOS_CAP = 500;
const knownRatios = new Map<string, number>();

function rememberRatio(uri: string, aspectRatio: number): void {
  knownRatios.delete(uri);
  knownRatios.set(uri, aspectRatio);
  if (knownRatios.size <= KNOWN_RATIOS_CAP) return;
  const oldest = knownRatios.keys().next().value;
  if (oldest !== undefined) knownRatios.delete(oldest);
}

export function useVideoAspectRatio(uri: string): { aspectRatio: number; onVideoSize: (size: VideoSize) => void } {
  const [measured, setMeasured] = useState<{ uri: string; aspectRatio: number }>();
  const onVideoSize = useCallback((size: VideoSize) => {
    const aspectRatio = mediaAspectRatio(size, VIDEO_PLACEHOLDER_RATIO);
    rememberRatio(uri, aspectRatio);
    setMeasured(prev => (prev?.uri === uri && prev.aspectRatio === aspectRatio ? prev : { uri, aspectRatio }));
  }, [uri]);
  const aspectRatio = measured?.uri === uri ? measured.aspectRatio : knownRatios.get(uri) ?? VIDEO_PLACEHOLDER_RATIO;
  return { aspectRatio, onVideoSize };
}
