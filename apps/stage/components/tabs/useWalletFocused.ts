import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';

export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);

  useEffect(() => {
    if (!everFocused && (pathname === base || pathname.startsWith(`${base}/`))) setEverFocused(true);
  }, [pathname, base, everFocused]);

  return everFocused;
}

export function useWalletFocused(): boolean {
  return useTabFocused('/wallet');
}
