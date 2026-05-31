/** Profile tab — the logged-in user's own profile, rendered through the shared
 *  ProfileScreen. The shared component resolves the active account address,
 *  detects this is "self", and shows the overflow "Edit profile" menu (no
 *  Message/Send). The same component powers the public `/user/[address]` route.
 *
 *  NOTE: the old manual PushTokenCard (FCM token copy + `metro call
 *  xmtp register-push` hint) lived here and was removed in the profile merge —
 *  push registration is moving to auto-register on the sibling feat/mobile-push
 *  branch, so the manual-copy card no longer has a home. */

import { useEffect, useState } from 'react';
import { getCachedXmtpClient, getOrCreateXmtpClient } from '../../lib/xmtp';
import { ProfileScreen } from '../ProfileScreen';

export function ProfileTabScreen(): React.ReactElement {
  const [address, setAddress] = useState<string>(
    getCachedXmtpClient()?.publicIdentity.identifier ?? '',
  );

  useEffect(() => {
    if (address) return;
    let alive = true;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        if (alive) setAddress(client.publicIdentity.identifier);
      } catch { /* leave blank — ProfileScreen renders the loading placeholder */ }
    })();
    return () => { alive = false; };
  }, [address]);

  return (
      <ProfileScreen address={address} variant="tab" />
  );
}
