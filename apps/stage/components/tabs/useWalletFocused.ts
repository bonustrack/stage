import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { isPathUnder } from '@stage-labs/client/routing/routes';
import { PAGES } from './pages';

export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);

  useEffect(() => {
    if (!everFocused && isPathUnder(pathname, base)) setEverFocused(true);
  }, [pathname, base, everFocused]);

  return everFocused;
}

export function useWalletFocused(): boolean {
  return useTabFocused(PAGES.wallet.href);
}
