import * as Linking from 'expo-linking';
import { useEffect } from 'react';
import { router } from 'expo-router';
import { routeForUrl, shouldHandleDeepLink } from '@stage-labs/client/routing/deepLinks';

function navigateToUrl(url: string): boolean {
  const target = routeForUrl(url);
  if (!target) return false;
  router.push(target);
  return true;
}

export function useDeepLinks(): void {
  useEffect(() => {
    let cancelled = false;

    void Linking.getInitialURL().then(url => {
      if (!cancelled && url && shouldHandleDeepLink(url)) navigateToUrl(url);
    });

    const sub = Linking.addEventListener('url', ({ url }) => {
      if (url && shouldHandleDeepLink(url)) navigateToUrl(url);
    });

    return () => {
      cancelled = true;
      sub.remove();
    };
  }, []);
}
