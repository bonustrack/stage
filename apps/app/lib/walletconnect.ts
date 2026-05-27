/** Reown AppKit (WalletConnect) configuration for the mobile app.
 *
 *  `@walletconnect/react-native-compat` MUST be imported before anything that
 *  touches crypto/networking globals — it's also hoisted to the very top of
 *  app/_layout.tsx, this re-import is a cheap no-op that keeps the module
 *  self-contained. `createAppKit` is called once at module load so the modal
 *  controller is ready by the time any screen calls `useAppKit().open()`. */

import '@walletconnect/react-native-compat';
import { mainnet } from 'viem/chains';
import { createAppKit, defaultWagmiConfig } from '@reown/appkit-wagmi-react-native';

/** Reused from the Snapshot UI (Less OK'd). A WalletConnect Cloud projectId is
 *  a public client identifier, not a secret. */
export const WC_PROJECT_ID = 'e6454bd61aba40b786e866a69bd4c5c6';

const metadata = {
  name: 'Metro',
  description: 'Metro — an XMTP messenger for Snapshot',
  url: 'https://metro.box',
  icons: ['https://metro.box/icon.png'],
  redirect: { native: 'metro://', universal: 'https://metro.box' },
};

/** mainnet is enough — we never broadcast L1 txs; the chain only scopes the
 *  WalletConnect session + EIP-191 personal_sign used for XMTP registration. */
const chains = [mainnet] as const;

export const wagmiConfig = defaultWagmiConfig({ chains, projectId: WC_PROJECT_ID, metadata });

createAppKit({
  projectId: WC_PROJECT_ID,
  metadata,
  wagmiConfig,
  defaultChain: mainnet,
  enableAnalytics: false,
});
