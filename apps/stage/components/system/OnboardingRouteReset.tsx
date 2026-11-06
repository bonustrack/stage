import { useEffect } from 'react';
import { router, useGlobalSearchParams, usePathname, useRootNavigationState } from 'expo-router';
import { nextRouteFor, signupHref } from '../onboarding/nextRoute.model';
import { PAGES, isOnboardingRoute } from '../tabs/pages';
import { currentRoute, prettifyRouteQuery } from '../../lib/navigation';

export function OnboardingRouteReset({ ready, showing }: { ready: boolean; showing: boolean }): null {
  const pathname = usePathname();
  const { next } = useGlobalSearchParams<{ next?: string }>();
  const navReady = useRootNavigationState()?.key !== undefined;
  const active = ready && showing && navReady;
  useEffect(() => {
    if (!active || isOnboardingRoute(pathname) || pathname === PAGES.chats.href) return;
    router.replace(signupHref(nextRouteFor(currentRoute(pathname))));
  }, [active, pathname]);
  useEffect(() => {
    if (!active || next === undefined) return;
    const frame = requestAnimationFrame(prettifyRouteQuery);
    return () => {
      cancelAnimationFrame(frame);
    };
  }, [active, pathname, next]);
  return null;
}
