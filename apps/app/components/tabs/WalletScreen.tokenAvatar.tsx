/**
 * @file Shared token avatar for the Wallet list: a token logo with an overlaid round network badge and an optional top-right badge (e.g. a Railgun shield).
 */

import { Image } from '@metro-labs/kit/image';
import { Box } from '../layout';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from './WalletScreen.assets';

/** Circular token avatar with the token logo and a network badge. */
export function TokenAvatar({ logoUrl, chainId, bg, border, badge }: {
  /** stamp.fyi token logo URL; empty string renders just the border circle. */
  logoUrl: string;
  chainId: number;
  /** Page background colour - the network/badge chip ring blends into it. */
  bg: string;
  /** Fallback fill behind the (possibly missing) logo + chip backgrounds. */
  border: string;
  /** Optional top-right overlay (e.g. a shield glyph for private rows). */
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
      {/* Network badge - round chip clipped to a circle, page-bg ring. */}
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
