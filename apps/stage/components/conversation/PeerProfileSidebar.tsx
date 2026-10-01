import { displayHandle } from '@stage-labs/client/identity/stageNames';
import { Text } from '@stage-labs/kit/react-native/text';
import { Avatar } from '../Avatar';
import { Box, Col, PAGE_GUTTER } from '../layout';
import { PROFILE_AVATAR_SIZE, ProfileCover } from '../ProfileCover';
import { profileDisplayName } from '../ProfileScreen.model';
import { getPeerHandle, getPeerName, usePeerProfiles } from '../../lib/peerProfiles';
import { usePalette } from '../../lib/theme';
import { shortAddress } from '../../modules/messaging';

export function PeerProfileSidebar({ address }: { address: string }): React.ReactElement {
  const { bg, border, text } = usePalette();
  usePeerProfiles([address]);
  const name = profileDisplayName(address, getPeerName(address), shortAddress(address));
  const handle = getPeerHandle(address);
  const identity = handle ? displayHandle(handle) : shortAddress(address);
  return (
    <ProfileCover
      insetTop={0}
      centered
      avatar={
        <Avatar
          key={address}
          address={address}
          size={PROFILE_AVATAR_SIZE}
          style={{ backgroundColor: border, borderWidth: 3, borderColor: bg }}
        />
      }
    >
      <Box padding={{ x: PAGE_GUTTER, bottom: PAGE_GUTTER }}>
        <Col gap={6} margin={{ top: 14 }}>
          <Text value={name} weight="semibold" size="4xl" textAlign="center" numberOfLines={2}/>
          {identity !== name ? <Text value={identity} size="sm" color={text} textAlign="center" numberOfLines={1}/> : null}
        </Col>
      </Box>
    </ProfileCover>
  );
}
