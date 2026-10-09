import { useRouter } from 'expo-router';
import { parseHandle } from '@stage-labs/client/routing/handles';
import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { usePalette } from '../../lib/theme';
import { usePeerProfiles } from '../../lib/peerProfiles';
import { profileLinkOf } from '../../lib/links';
import { peerLabel } from './convTitle';
import { ConvTopnavIdentity, ConvTopnavShell } from './parts';
import { homeRoute } from '../tabs/boardHome';

export function PeerTopnav({ peer }: { peer?: string }): React.ReactElement {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { text: fg, link: head, border } = usePalette();
  const parsed = parseHandle(peer);
  const address = parsed.kind === 'address' ? parsed.value : null;
  usePeerProfiles([address]);
  const title = address ? peerLabel(address)
    : parsed.kind === 'stage' || parsed.kind === 'basename' || parsed.kind === 'ens'
      ? displayHandle(parsed.value) : 'Conversation';
  return (
    <ConvTopnavShell fg={fg} border={border} safeTop={insets.top} onBack={() => { router.replace(homeRoute()); }}>
      <ConvTopnavIdentity
        peerAddr={address} groupImage="" channelId="" isGroup={false}
        border={border} head={head} title={{ text: title, placeholder: false }}
        onPress={address ? () => { router.push(profileLinkOf(address)); } : undefined}
      />
    </ConvTopnavShell>
  );
}
