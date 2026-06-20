
import { useEffect, useState } from 'react';

import { Pressable } from '@stage-labs/kit/pressable';
import { Text } from '@stage-labs/kit/text';
import { Avatar } from './Avatar';
import { MenuSheet } from './MenuSheet';
import { Row } from './layout';
import { usePalette } from '../lib/theme';
import { useActiveAccount } from '../modules/messaging';
import { getActiveAccount } from '../lib/accounts';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';

export function TopnavIdentity(): React.ReactElement {
  const { link: head, border } = usePalette();
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
          <Avatar address={myAddress} size={28} style={{ backgroundColor: border }} />
          {myName ? (
            <Text weight="semibold" size="4xl"
              numberOfLines={1} color={head} style={{ maxWidth: 200 }}>
              {myName}
            </Text>
          ) : null}
        </Row>
      </Pressable>
      <MenuSheet visible={menuOpen} onClose={() => { setMenuOpen(false); }} />
    </>
  );
}
