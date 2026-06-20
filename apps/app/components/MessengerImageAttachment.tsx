/** @file MessengerImageAttachment: inline image message attachment with a tap-to-open fullscreen ImageViewer and no-blank source-swap handling. */

import { useEffect, useRef, useState } from 'react';
import type { ImageStyle } from 'react-native';
import { Image } from '@metro-labs/kit/image';
import { MediaCard } from './MediaCard';
import { ImageViewer } from './ImageViewer';

/** Absolute-fill as an ImageStyle (StyleSheet.absoluteFill is typed for View, not Image — Kit Image's style prop is ImageStyle). */
const ABSOLUTE_FILL: ImageStyle = { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 };

/** Renders an image message attachment with a tap-to-open fullscreen viewer. */
export function MessengerImageAttachment({ uri, dark = true }: {
  uri: string; dark?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  /** No-blank swap: when `uri` changes, keep the previously-loaded image painted underneath until the new source's `onLoad` fires, avoiding the decode-time blank flicker. */
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    /** Source changed to one we haven't shown yet → stage the old one as the placeholder beneath the incoming image. */
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
