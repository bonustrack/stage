import { useCallback, useRef, useState } from 'react';
import type { ImageLoadEventData, NativeSyntheticEvent } from 'react-native';
import { getImageSize } from '@stage-labs/kit/react-native/image';
import { ignore } from '../lib/errorPolicy';
import { mediaAspectRatio, validSize } from './bubble/imageBox.model';

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
