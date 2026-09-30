import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageStyle } from 'react-native';
import { Image } from '@stage-labs/kit/react-native/image';
import { MediaCard } from '../MediaCard';
import { ChatImageViewer } from './ChatGallery';

const ABSOLUTE_FILL: ImageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

export function MessengerImageAttachment({ uri, galleryKey }: { uri: string; galleryKey?: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    if (loadedUri.current && loadedUri.current !== uri) setPrevUri(loadedUri.current);
  }, [uri]);
  const onLoad = useCallback(() => {
    loadedUri.current = uri;
    setPrevUri(null);
  }, [uri]);
  return (
    <>
      <MediaCard onPress={() => { setOpen(true); }}>
        {prevUri && prevUri !== uri ? (
          <Image src={prevUri} style={ABSOLUTE_FILL} fit="cover" />
        ) : null}
        <Image src={uri} width="100%" height="100%" fit="cover" onLoad={onLoad} />
      </MediaCard>
      <ChatImageViewer uri={uri} galleryKey={galleryKey} visible={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
