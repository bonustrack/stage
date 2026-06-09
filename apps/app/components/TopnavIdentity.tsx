/** TopnavIdentity — the avatar + display-name element shown in the Home topnav,
 *  reused across the wallet, notifications, and profile tabs for a consistent
 *  identity affordance. Self-contained: resolves the active account address,
 *  resolves its display name (getPeerName ?? shortAddress via usePeerProfiles),
 *  renders a 28px avatar + name, and routes to /menu on tap (account switcher +
 *  Profile/Settings), matching the Home topnav exactly. */

import { useEffect, useState } from 'react';

import { Pressable } from '@metro-labs/kit/pressable';
import { useRouter } from 'expo-router';
import { Text } from '@metro-labs/kit/text';
import { Avatar } from './Avatar';
import { Row } from './layout';
import { usePalette } from '../lib/theme';
import { useActiveAccount } from '../modules/messaging';
import { getActiveAccount } from '../lib/accounts';
import { usePeerProfiles, getPeerName } from '../lib/peerProfiles';
import { shortAddress } from '../modules/messaging';

export function TopnavIdentity(): React.ReactElement {
  const router = useRouter();
  const { link: head, border } = usePalette();
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

  // Resolve the active account's display name (ENS / profile) the same way the
  // Home topnav + Menu account header do (getPeerName ?? shortAddress);
  // usePeerProfiles re-renders this row once the batch resolves.
  usePeerProfiles([myAddress]);
  const myName = myAddress ? (getPeerName(myAddress) ?? shortAddress(myAddress)) : '';

  // Avatar opens the Menu page (account switcher + Profile/Settings), exactly as
  // on Home — the single canonical identity tap-target across tabs.
  return (
    <Pressable onPress={() => router.push('/menu')} hitSlop={8}>
      <Row align="center" gap={8}>
        <Avatar address={myAddress} size={28} style={{ backgroundColor: border }} />
        {myName ? (
          <Text weight="semibold" size="xl"
            numberOfLines={1}
            style={{ color: head, maxWidth: 200 }}
          >
            {myName}
          </Text>
        ) : null}
      </Row>
    </Pressable>
  );
}
