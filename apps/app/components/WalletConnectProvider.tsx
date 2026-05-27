/** Wraps the app in wagmi's provider + mounts the AppKit modal. Must sit inside
 *  the app's QueryClientProvider (wagmi v2 needs TanStack Query as an ancestor),
 *  which app/_layout.tsx already provides. The <AppKit/> modal portals above
 *  everything, so its position in the tree doesn't matter. */

import { WagmiProvider } from 'wagmi';
import { AppKit } from '@reown/appkit-wagmi-react-native';
import { wagmiConfig } from '../lib/walletconnect';

export function WalletConnectProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
      <AppKit />
    </WagmiProvider>
  );
}
