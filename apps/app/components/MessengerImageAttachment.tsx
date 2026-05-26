/** Inline image attachment — tap to open a fullscreen lightbox modal. The
 *  thumbnail itself is wrapped in `MediaCard` for visual parity with other
 *  embeds (YouTube, location, video). */

import { useState } from 'react';
import { Image, Modal, Pressable } from 'react-native';
import { HeroIcon } from './HeroIcon';
import { MediaCard } from './MediaCard';

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
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' }}
        >
          <Image source={{ uri }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          <Pressable
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', top: 40, right: 20, padding: 10 }}
            hitSlop={10}
          >
            <HeroIcon name="x" size={28} color="#ffffff" />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
