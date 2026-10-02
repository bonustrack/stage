import { useCallback, useRef, useState } from 'react';
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native';
import { getImageSize } from '@stage-labs/kit/react-native/image';
import type { VideoSize } from '@stage-labs/kit/react-native/video-player';
import { ignore } from '../../lib/errorPolicy';
import { VIDEO_PLACEHOLDER_RATIO, mediaAspectRatio, validSize } from './imageBox.model';

type ImageLoaded = (event: NativeSyntheticEvent<ImageLoadEventData>) => void;

export function useImageAspectRatio(uri: string): { aspectRatio: number; onLoad: ImageLoaded } {
  const [natural, setNatural] = useState<{ uri: string; aspectRatio: number }>();
  const currentUri = useRef(uri);
  currentUri.current = uri;
  const onLoad = useCallback<ImageLoaded>((event) => {
    if (currentUri.current !== uri) return;
    const learn = (measured: { width?: number; height?: number } | undefined): boolean => {
      const size = validSize(measured);
      if (!size || currentUri.current !== uri) return false;
      setNatural({ uri, aspectRatio: mediaAspectRatio(size) });
      return true;
    };
    if (!learn(event.nativeEvent.source)) ignore(getImageSize(uri).then(learn), 'ui');
  }, [uri]);
  const aspectRatio = natural?.uri === uri ? natural.aspectRatio : 1;
  return { aspectRatio, onLoad };
}

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
