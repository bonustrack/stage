import { useEffect, useLayoutEffect } from 'react';
import { usePathname } from 'expo-router';

const positions = new Map<string, number>();

if (typeof history !== 'undefined') history.scrollRestoration = 'manual';

export function useDocumentScrollRestore(): void {
  const pathname = usePathname();
  useEffect(() => {
    const remember = (): void => { positions.set(pathname, window.scrollY); };
    window.addEventListener('scroll', remember, { passive: true });
    return () => { window.removeEventListener('scroll', remember); };
  }, [pathname]);
  useLayoutEffect(() => {
    window.scrollTo({ top: positions.get(pathname) ?? 0, behavior: 'instant' });
  }, [pathname]);
}
