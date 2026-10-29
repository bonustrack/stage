import { Image } from '@stage-labs/kit/react-native/image';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from '@stage-labs/client/wallet/assets';
import { Column } from '../../layout';

export function TokenAvatar({
  logoUrl,
  chainId,
  bg,
  border,
  size = 32,
  badgeSize = 18,
}: {
  logoUrl: string;
  chainId: number;
  bg: string;
  border: string;
  size?: number;
  badgeSize?: number;
}): React.ReactElement {
  return (
    <Column width={size} height={size}>
      <Image fit="cover" url={logoUrl} size={size} radius="full" background={border} />
      <Column
        width={badgeSize}
        height={badgeSize}
        radius="full"
        background={border}
        style={{ position: 'absolute', right: -3, bottom: -3, borderWidth: 2.5, borderColor: bg, overflow: 'hidden' }}
      >
        <Image url={NETWORK_LOGO[chainId] ?? MAINNET_NETWORK_LOGO} fit="cover" width="100%" height="100%" />
      </Column>
    </Column>
  );
}
