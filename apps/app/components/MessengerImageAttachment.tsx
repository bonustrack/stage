/** Inline image attachment — tap to open the shared fullscreen ImageViewer
 *  (large preview + download). The thumbnail itself is wrapped in `MediaCard`
 *  for visual parity with other embeds (YouTube, location, video). */

import { useEffect, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { Image } from '@metro-labs/kit/image';
import { MediaCard } from './MediaCard';
import { ImageViewer } from './ImageViewer';

export function MessengerImageAttachment({ uri, dark = true }: {
  uri: string; dark?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  /** No-blank swap: when `uri` changes (local `file://` → resolved remote copy)
   *  keep the previously-loaded image painted underneath until the new source's
   *  `onLoad` fires, then drop the old layer. Without this the <Image> blanks for
   *  the frames it takes to decode the new source — the "image disappears then
   *  reappears" flicker. `prevUri` is the last source we know finished loading. */
  const [prevUri, setPrevUri] = useState<string | null>(null);
  const loadedUri = useRef<string | null>(null);
  useEffect(() => {
    /** Source changed to one we haven't shown yet → stage the old one as the
     *  placeholder beneath the incoming image. */
    if (loadedUri.current && loadedUri.current !== uri) setPrevUri(loadedUri.current);
  }, [uri]);
  return (
    <>
      <MediaCard dark={dark} onPress={() => setOpen(true)} width={220}>
        {prevUri && prevUri !== uri ? (
          <Image src={prevUri} style={StyleSheet.absoluteFill} fit="cover" />
        ) : null}
        <Image
          src={uri}
          width="100%"
          aspectRatio={1}
          fit="cover"
          onLoad={() => { loadedUri.current = uri; if (prevUri) setPrevUri(null); }}
        />
      </MediaCard>
      <ImageViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
