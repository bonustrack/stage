import { useEffect } from 'react';
import { router, usePathname, useRootNavigationState } from 'expo-router';

export function OnboardingRouteReset({ ready, showing }: { ready: boolean; showing: boolean }): null {
  const pathname = usePathname();
  const navReady = useRootNavigationState()?.key !== undefined;
  const active = ready && showing && navReady;
  useEffect(() => {
    if (!active || pathname === '/') return;
    router.replace('/');
  }, [active, pathname]);
  return null;
}
