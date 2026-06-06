/** Shared token avatar + network badge for the Wallet list.
 *
 *  The 32x32 token logo with a small round network-logo chip overlaid at the
 *  bottom-right, exactly as the Snapshot-treasury wallet rows render it.
 *  Extracted from WalletScreen.parts (TokenRow) so other surfaces - the private
 *  Activity rows - reuse the SAME rendering instead of rebuilding it. The chip
 *  ring uses the page bg colour; the network logo fills (cover) and is clipped
 *  to a circle so a square logo (e.g. Base) renders identically to Ethereum.
 *
 *  An optional `badge` overlays the TOP-right corner (e.g. a Railgun shield) so
 *  callers can mark a row as private without touching the avatar geometry. */

import { Image } from 'react-native';
import { Box } from '../layout';
import { NETWORK_LOGO, MAINNET_NETWORK_LOGO } from './WalletScreen.assets';

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
    <Box style={{ width: 32, height: 32 }}>
      <Image
        source={{ uri: logoUrl }}
        style={{ width: 32, height: 32, borderRadius: 999, backgroundColor: border }}
      />
      {/* Network badge - round chip clipped to a circle, page-bg ring. */}
      <Box style={{
        position: 'absolute', right: -3, bottom: -3,
        width: 18, height: 18, borderRadius: 999,
        borderWidth: 2.5, borderColor: bg, backgroundColor: border,
        overflow: 'hidden',
      }}>
        <Image
          source={{ uri: NETWORK_LOGO[chainId] ?? MAINNET_NETWORK_LOGO }}
          resizeMode="cover"
          style={{ width: '100%', height: '100%' }}
        />
      </Box>
      {badge ? (
        <Box style={{
          position: 'absolute', right: -5, top: -5,
          width: 18, height: 18, borderRadius: 999,
          borderWidth: 2, borderColor: bg, backgroundColor: bg,
          alignItems: 'center', justifyContent: 'center',
        }}>
          {badge}
        </Box>
      ) : null}
    </Box>
  );
}
