import type { ReactElement } from 'react';
import { Redirect, useIsFocused } from 'expo-router';
import { WALLET_ENABLED } from '../../lib/features';

export function WalletGate({ children }: { children: ReactElement | null }): ReactElement | null {
  const focused = useIsFocused();
  if (WALLET_ENABLED) return children;
  return focused ? <Redirect href="/" /> : null;
}
