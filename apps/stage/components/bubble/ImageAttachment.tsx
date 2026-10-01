import { useCallback, useEffect, useRef, useState } from 'react';
import type { ImageStyle, ViewStyle } from 'react-native';
import { Image } from '@stage-labs/kit/react-native/image';
import { MediaCard } from '../MediaCard';
import { Spinner } from '@stage-labs/kit/react-native/spinner';
import { Box, Row } from '../layout';
import { usePalette } from '../../lib/theme';
import { ChatImageViewer } from './ChatGallery';

const ABSOLUTE_FILL: ImageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };
const TILE_DECODE = { resizeMethod: 'resize', resizeMultiplier: 4 / 3 } as const;
const LOADING_CLIP: ViewStyle = { overflow: 'hidden' };
const LOADING_TILE: ViewStyle = { position: 'absolute', top: 0, left: 0, right: 0, opacity: 0, pointerEvents: 'none' };

export function ImageLoading(): React.ReactElement {
  const { sub } = usePalette();
  return (
    <Row testID="image-loading" padding={{ y: 4 }}>
      <Spinner size={20} color={sub} />
    </Row>
  );
}

export function MessengerImageAttachment({ uri, galleryKey }: { uri: string; galleryKey?: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(false);
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    if (loadedUri.current && loadedUri.current !== uri) setPrevUri(loadedUri.current);
  }, [uri]);
  const onLoad = useCallback(() => {
    loadedUri.current = uri;
    setPrevUri(null);
    setShown(true);
  }, [uri]);
  const onError = useCallback(() => { setShown(true); }, []);
  return (
    <>
      <Box style={shown ? undefined : LOADING_CLIP}>
        {shown ? null : <ImageLoading />}
        <Box style={shown ? undefined : LOADING_TILE}>
          <MediaCard onPress={() => { setOpen(true); }}>
            {prevUri && prevUri !== uri ? (
              <Image src={prevUri} style={ABSOLUTE_FILL} fit="contain" {...TILE_DECODE} />
            ) : null}
            <Image src={uri} width="100%" height="100%" fit="contain" onLoad={onLoad} onError={onError} {...TILE_DECODE} />
          </MediaCard>
        </Box>
      </Box>
      <ChatImageViewer uri={uri} galleryKey={galleryKey} visible={open} onClose={() => { setOpen(false); }} />
    </>
  );
}
