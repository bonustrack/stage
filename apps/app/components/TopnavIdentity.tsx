/** @file The topnav avatar + display-name element (shared across Home/contacts/wallet tabs) that resolves the active account's address and name and opens the Menu sheet on tap. */

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

/** Top-nav identity slot rendering the user's avatar and name as a menu trigger. */
export function TopnavIdentity(): React.ReactElement {
  const { link: head, border } = usePalette();
  const [menuOpen, setMenuOpen] = useState(false);
  /** Active account's own address → topnav avatar; re-resolved on account switch. */
  const [myAddress, setMyAddress] = useState<string | null>(null);
  const accountEpoch = useActiveAccount();
  useEffect(() => {
    let cancelled = false;
    void getActiveAccount().then(acct => {
      if (!cancelled) setMyAddress(acct?.address ?? null);
    });
    return () => { cancelled = true; };
  }, [accountEpoch]);

  /** Resolve the active account's display name via getPeerName ?? shortAddress (as Home topnav + Menu header do); usePeerProfiles re-renders this row once the batch resolves. */
  usePeerProfiles([myAddress]);
  const myName = myAddress ? (getPeerName(myAddress) ?? shortAddress(myAddress)) : '';

  /** Avatar opens the Menu sheet (account switcher + Profile/Settings), the single canonical identity tap-target across tabs as on Home. */
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
