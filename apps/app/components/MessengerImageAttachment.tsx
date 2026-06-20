
import { useEffect, useRef, useState } from 'react';
import type { ImageStyle } from 'react-native';
import { Image } from '@stage-labs/kit/image';
import { MediaCard } from './MediaCard';
import { ImageViewer } from './ImageViewer';

const ABSOLUTE_FILL: ImageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

export function MessengerImageAttachment({ uri, dark = true }: {
  uri: string; dark?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    if (loadedUri.current && loadedUri.current !== uri) setPrevUri(loadedUri.current);
  }, [uri]);
  return (
    <>
      <MediaCard dark={dark} onPress={() => { setOpen(true); }} width={220}>
        {prevUri && prevUri !== uri ? (
          <Image src={prevUri} style={ABSOLUTE_FILL} fit="cover" />
        ) : null}
        <Image
          src={uri}
          width="100%"
          aspectRatio={1}
          fit="cover"
          onLoad={() => { loadedUri.current = uri; if (prevUri) setPrevUri(null); }}
        />
      </MediaCard>
      <ImageViewer uri={uri} visible={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
