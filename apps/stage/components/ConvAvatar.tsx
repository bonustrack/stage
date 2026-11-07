import type { AvatarSize } from '@stage-labs/kit/avatar';
import { Avatar } from './Avatar';
import { channelAvatar } from './convIdentity';

export interface ConvAvatarProps {
  peerAddr: string | null;
  groupImage: string;
  channelId: string;
  isGroup: boolean;
  border: string;
}

export function ConvAvatar({
  peerAddr,
  groupImage,
  channelId,
  isGroup,
  border,
  size,
}: ConvAvatarProps & { size: AvatarSize }): React.ReactElement | null {
  const style = { backgroundColor: border };
  if (peerAddr) return <Avatar address={peerAddr} size={size} style={style} />;
  if (!isGroup && !groupImage) return null;
  const { avatarUri, avatarAddress } = channelAvatar(channelId, groupImage);
  if (avatarUri === null && avatarAddress === null) return null;
  return <Avatar imageUri={avatarUri} address={avatarAddress} size={size} square style={style} />;
}
