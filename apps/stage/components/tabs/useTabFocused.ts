import { useEffect, useState } from 'react';
import { usePathname } from 'expo-router';
import { isPathUnder } from '@stage-labs/client/routing/routes';

export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);

  useEffect(() => {
    if (!everFocused && isPathUnder(pathname, base)) setEverFocused(true);
  }, [pathname, base, everFocused]);

  return everFocused;
}
