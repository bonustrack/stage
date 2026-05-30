/** The actual wagmi + AppKit provider. Isolated in its own module so the heavy
 *  dependency graph it pulls in — @reown/appkit-wagmi-react-native, wagmi, viem,
 *  and lib/walletconnect's module-load `createAppKit()` — is NOT evaluated at app
 *  startup. It is required lazily (after first paint) by
 *  DeferredWalletConnectProvider in ./WalletConnectProvider. */

import { type ReactNode, type ReactElement } from 'react';
import { WagmiProvider } from 'wagmi';
import { AppKit } from '@reown/appkit-wagmi-react-native';
import { wagmiConfig } from '../lib/walletconnect';

export function WalletConnectProvider({ children }: { children: ReactNode }): ReactElement {
  return (
    <WagmiProvider config={wagmiConfig}>
      {children}
      <AppKit />
    </WagmiProvider>
  );
}
