
import { router } from 'expo-router';
import { ChannelRow } from './ChannelRow';
import { Box } from './layout';
import { usePeerProfiles, getPeerName, isPeerResolved } from '../lib/peerProfiles';
import { usePalette, useBlockRadius } from '../lib/theme';
import { openDmWithAddress, shortAddress } from '../modules/messaging';

export function DmPeerCard({ address }: { address: string }): React.ReactElement {
  usePeerProfiles([address]);
  const { border } = usePalette();
  const blockRadius = useBlockRadius();

  const peerName = getPeerName(address);
  const title = peerName == null || peerName === '' ? shortAddress(address) : peerName;
  const avatarAddress = !isPeerResolved(address) ? null : address;

  const open = (): void => {
    void (async () => {
      try {
        const convId = await openDmWithAddress(address);
        router.push({ pathname: '/xmtp/[convId]', params: { convId } });
      } catch { }
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
