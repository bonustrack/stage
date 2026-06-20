
import { Image } from '@stage-labs/kit/image';
import { Box } from '../layout';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from './WalletScreen.assets';

export function TokenAvatar({ logoUrl, chainId, bg, border, badge }: {
  logoUrl: string;
  chainId: number;
  bg: string;
  border: string;
  badge?: React.ReactNode;
}): React.ReactElement {
  return (
    <Box width={32} height={32}>
      <Image
        src={logoUrl}
        size={32}
        radius="full"
        background={border}
/>
      {}
      <Box width={18} height={18} radius="full" background={border} style={{ position: 'absolute', right: -3, bottom: -3, borderWidth: 2.5, borderColor: bg, overflow: 'hidden' }}>
        <Image
          src={NETWORK_LOGO[chainId] ?? MAINNET_NETWORK_LOGO}
          fit="cover"
          width="100%"
          height="100%"
/>
      </Box>
      {badge ? (
        <Box width={18} height={18} radius="full" surface="surface" align="center" justify="center" style={{ position: 'absolute', right: -5, top: -5, borderWidth: 2, borderColor: bg }}>
          {badge}
        </Box>
      ) : null}
    </Box>
  );
}
