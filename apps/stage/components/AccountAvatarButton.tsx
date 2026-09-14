import { useState } from 'react';
import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Col } from './layout';
import { MenuSheet } from './MenuSheet';
import { menuPointBelow, menuPointBeside } from './AnchoredMenu';
import type { MenuPoint } from './AnchoredMenu.model';
import { usePalette } from '../lib/theme';
import { usePeerProfiles, peerAvatarUrl } from '../lib/peerProfiles';
import { useActiveAccountRecord } from '../modules/messaging';

export function AccountAvatarButton({ size = 28, opens = 'below' }: {
  size?: number;
  opens?: 'below' | 'beside';
}): React.ReactElement {
  const { border } = usePalette();
  const [menuAnchor, setMenuAnchor] = useState<MenuPoint | null>(null);
  const myAddress = useActiveAccountRecord()?.address ?? null;
  usePeerProfiles([myAddress]);
  return (
    <>
      <Pressable
        accessibilityLabel="Account"
        onPress={(e) => { setMenuAnchor(opens === 'beside' ? menuPointBeside(e) : menuPointBelow(e)); }}
        hitSlop={8}
      >
        {myAddress ? (
          <Image src={peerAvatarUrl(myAddress, size)} size={size} radius="full" background={border} />
        ) : (
          <Col size={size} radius="full" background={border} />
        )}
      </Pressable>
      <MenuSheet visible={menuAnchor !== null} anchor={menuAnchor} onClose={() => { setMenuAnchor(null); }} />
    </>
  );
}
