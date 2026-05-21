/** Inline image attachment — tap to open a fullscreen lightbox modal. */

import { useState } from 'react';
import { Image, Modal, Pressable } from 'react-native';
import { HeroIcon } from './HeroIcon';

export function MessengerImageAttachment({ uri }: { uri: string }): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable onPress={() => setOpen(true)}>
        <Image
          source={{ uri }}
          style={{ width: 220, height: 220, borderRadius: 10, marginBottom: 6 }}
          resizeMode="cover"
        />
      </Pressable>
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
