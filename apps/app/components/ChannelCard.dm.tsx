/** Inline card for a DM-by-address link (`metro://xmtp/user/<address>`).
 *  Unlike a conv-id card, a DM share carries only the PEER's eth address — the
 *  conversation id is installation-local, so each side resolves their OWN local
 *  DM on tap via `openDmWithAddress` (findOrCreateDmWithIdentity). Metadata
 *  (name + avatar) comes straight from `peerProfiles`, keyed on the address, so
 *  the card renders for the recipient even though they're not a member of the
 *  sender's local conversation row. */

import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { Box } from './layout';
import {
  usePeerProfiles, getPeerName, getPeerAvatar, getPeerAvatarCb, isPeerResolved,
} from '../lib/peerProfiles';
import { usePalette } from '../lib/theme';
import { openDmWithAddress, shortAddress } from '../lib/xmtp';

export function DmPeerCard({ address }: { address: string }): React.ReactElement {
  usePeerProfiles([address]);
  const { border } = usePalette();

  const title = getPeerName(address) || shortAddress(address);
  const avatarUri = getPeerAvatar(address) || null;
  /** Hold the stamp back until the peer profile resolves so we don't flash a
   *  cache-buster-less identicon before the real URL lands (mirrors ChannelCard). */
  const avatarAddress = avatarUri || !isPeerResolved(address) ? null : address;

  const open = (): void => {
    void (async () => {
      try {
        const convId = await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId } });
      } catch { /* client not ready / resolve failed — leave the card in place */ }
    })();
  };

  return (
    <Box radius={14} style={{ borderWidth: 1, borderColor: border, overflow: 'hidden' }}>
      <ChannelRow
        title={title}
        subtitle="Direct message"
        avatarUri={avatarUri}
        avatarAddress={avatarAddress}
        cacheBuster={getPeerAvatarCb(address)}
        onPress={open}
        noBorder
      />
    </Box>
  );
}
