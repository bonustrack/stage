import { Image } from '@stage-labs/kit/react-native/image';
import { networkLogo } from '@stage-labs/client/wallet/chains';
import { Column } from '../layout';

interface TokenAvatarBase {
  logoUrl: string;
  chainId: number;
  size: number;
  badgeSize: number;
}

interface CornerBadge extends TokenAvatarBase {
  badge: 'corner';
  logoBackground: string;
  badgeBackground?: string;
  ring: { color: string; width: number };
}

interface BadgeBelow extends TokenAvatarBase {
  badge: 'below';
}

export type TokenAvatarProps = CornerBadge | BadgeBelow;

export function TokenAvatar(props: TokenAvatarProps): React.ReactElement {
  const { logoUrl, chainId, size, badgeSize } = props;
  if (props.badge === 'below') {
    return (
      <Column>
        <Image fit="cover" url={logoUrl} size={size} radius="full" />
        <Image fit="cover" url={networkLogo(chainId)} size={badgeSize} radius="full" />
      </Column>
    );
  }
  const { badgeBackground, ring } = props;
  return (
    <Column width={size} height={size}>
      <Image fit="cover" url={logoUrl} size={size} radius="full" background={props.logoBackground} />
      <Column
        width={badgeSize}
        height={badgeSize}
        radius="full"
        {...(badgeBackground === undefined ? { surface: 'surface' as const } : { background: badgeBackground })}
        style={{ position: 'absolute', right: -3, bottom: -3, borderWidth: ring.width, borderColor: ring.color, overflow: 'hidden' }}
      >
        <Image url={networkLogo(chainId)} fit="cover" width="100%" height="100%" />
      </Column>
    </Column>
  );
}
