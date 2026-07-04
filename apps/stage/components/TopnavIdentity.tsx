
import { useEffect, useState } from 'react';

import { Image } from '@stage-labs/kit/react-native/image';
import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { Text } from '@stage-labs/kit/react-native/text';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { Row, Col } from './layout';
import { MenuSheet } from './MenuSheet';
import { usePalette } from '../lib/theme';
import { useActiveAccount } from '../modules/messaging';
import { getActiveAccount } from '../lib/accounts';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';

export function TopnavIdentity(): React.ReactElement {
  const { border } = usePalette();
  const [menuOpen, setMenuOpen] = useState(false);
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const accountEpoch = useActiveAccount();
  useEffect(() => {
    let cancelled = false;
    void getActiveAccount().then(acct => {
      if (!cancelled) setMyAddress(acct?.address ?? null);
    });
    return () => { cancelled = true; };
  }, [accountEpoch]);

  usePeerProfiles([myAddress]);
  const myName = myAddress ? (getPeerName(myAddress) ?? shortAddress(myAddress)) : '';

  return (
    <>
      <Pressable onPress={() => { setMenuOpen(true); }} hitSlop={8}>
        <Row align="center" gap={8}>
          {myAddress ? (
            <Image src={stampAvatarUrl(myAddress, 28)} size={28} radius="full" background={border} />
          ) : (
            <Col size={28} radius="full" background={border} />
          )}
          {myName !== '' ? (
            <Row maxWidth={200}>
              <Text value={myName} size="4xl" weight="semibold" color="link" truncate />
            </Row>
          ) : null}
        </Row>
      </Pressable>
      <MenuSheet visible={menuOpen} onClose={() => { setMenuOpen(false); }} />
    </>
  );
}
