/** @file Inline card for a DM-by-address link (metro://xmtp/user/<address>), resolving the local DM on tap via openDmWithAddress and pulling name/avatar from peerProfiles keyed on the peer address. */

import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { Box } from './layout';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { usePalette, useBlockRadius } from '../lib/theme';
import { openDmWithAddress, shortAddress } from '../modules/messaging';

/** Renders an inline card for a DM-by-address link that opens the local DM with the peer on tap. */
export function DmPeerCard({ address }: { address: string }): React.ReactElement {
  usePeerProfiles([address]);
  const { border } = usePalette();
  const blockRadius = useBlockRadius();

  const peerName = getPeerName(address);
  const title = peerName == null || peerName === '' ? shortAddress(address) : peerName;
  /** Hold the stamp back until the peer profile resolves so we don't flash an identicon before the name lands (mirrors ChannelCard). */
  const avatarAddress = !isPeerResolved(address) ? null : address;

  /** Open helper. */
  const open = (): void => {
    void (async () => {
      try {
        const convId = await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId } });
      } catch { /* client not ready / resolve failed — leave the card in place */ }
    })();
  };

  return (
    <Box radius={blockRadius} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      <ChannelRow
        title={title}
        subtitle="Direct message"
        avatarAddress={avatarAddress}
        onPress={open}
        noBorder
      />
    </Box>
  );
}
