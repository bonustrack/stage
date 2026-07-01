
import { useEffect, useState } from 'react';

import { Pressable } from '@stage-labs/kit/react-native/pressable';
import { ViewHost } from '@stage-labs/kit/react-native/view-host';
import { stampAvatarUrl } from '@stage-labs/kit/avatar';
import { basicRoot, topnavIdentity } from '@stage-labs/views';
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
        <ViewHost
          node={basicRoot(topnavIdentity({
            avatarUri: myAddress ? stampAvatarUrl(myAddress, 28) : '',
            avatarBackground: border,
            name: myName,
          }))}
        />
      </Pressable>
      <MenuSheet visible={menuOpen} onClose={() => { setMenuOpen(false); }} />
    </>
  );
}
