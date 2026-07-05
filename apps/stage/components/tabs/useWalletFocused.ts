import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';

export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);
  const latched = useRef(false);

  useEffect(() => {
    if (latched.current) return;
    if (pathname === base || pathname.startsWith(`${base}/`)) {
      latched.current = true;
      setEverFocused(true);
    }
  }, [pathname, base]);

  return everFocused;
}

export function useWalletFocused(): boolean {
  return useTabFocused('/wallet');
}

export function useContactsFocused(): boolean {
  return useTabFocused('/contacts');
}
