import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageLoadEventData, ImageStyle, NativeSyntheticEvent } from 'react-native';
import { Image } from '@stage-labs/kit/react-native/image';
import { MediaCard } from '../MediaCard';
import { ImageViewer } from '../ImageViewer';
import { imageBox, loadedImageSize, sameSize, type ImageSize } from './imageBox.model';

const ABSOLUTE_FILL: ImageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const KNOWN_SIZES_CAP = 500;
const knownSizes = new Map<string, ImageSize>();

function rememberSize(uri: string, size: ImageSize): void {
  knownSizes.delete(uri);
  knownSizes.set(uri, size);
  if (knownSizes.size <= KNOWN_SIZES_CAP) return;
  const oldest = knownSizes.keys().next().value;
  if (oldest !== undefined) knownSizes.delete(oldest);
}

export function MessengerImageAttachment({ uri }: { uri: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const [natural, setNatural] = useState<ImageSize | undefined>(() => knownSizes.get(uri));
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    if (loadedUri.current && loadedUri.current !== uri) setPrevUri(loadedUri.current);
  }, [uri]);
  const onLoad = useCallback((event: NativeSyntheticEvent<ImageLoadEventData>) => {
    const size = loadedImageSize(event.nativeEvent);
    if (size) {
      rememberSize(uri, size);
      setNatural(prev => (sameSize(prev, size) ? prev : size));
    }
    loadedUri.current = uri;
    setPrevUri(null);
  }, [uri]);
  const box = imageBox(knownSizes.get(uri) ?? natural);
  return (
    <>
      <MediaCard onPress={() => { setOpen(true); }} width={box.width} maxWidth="100%">
        {prevUri && prevUri !== uri ? (
          <Image src={prevUri} style={ABSOLUTE_FILL} fit="cover" />
        ) : null}
        <Image src={uri} width="100%" aspectRatio={box.aspectRatio} fit="cover" onLoad={onLoad} />
      </MediaCard>
      <ImageViewer uri={uri} visible={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
