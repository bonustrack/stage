/** Inline image attachment — tap to open the shared fullscreen ImageViewer
 *  (large preview + download). The thumbnail itself is wrapped in `MediaCard`
 *  for visual parity with other embeds (YouTube, location, video). */

import { useState } from 'react';
import { Image } from 'react-native';
import { MediaCard } from './MediaCard';
import { ImageViewer } from './ImageViewer';

export function MessengerImageAttachment({ uri, dark = true }: {
  uri: string; dark?: boolean;
}): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <MediaCard dark={dark} onPress={() => setOpen(true)} width={220}>
        <Image
          source={{ uri }}
          style={{ width: '100%', aspectRatio: 1 }}
          resizeMode="cover"
        />
      </MediaCard>
      <ImageViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}
