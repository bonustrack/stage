/** @file useTabFocused hook: a sticky pathname-derived latch for whether a tab route has ever been active; callers gate one-time boot work on it (e.g. Wallet Railgun engine) and it never flips back. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';

/** Sticky "has this tab's route ever been active" latch, matching `/<tab>` and `/<tab>/*` (the pager's index rule) and latching once true so gated boot work runs only once. */
export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);
  /** Avoid a redundant setState once latched (the effect would otherwise re-run on every pathname change for the rest of the session). */
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

/** True from the first moment the Wallet tab (or a /wallet/* sub-route) is active, sticky thereafter — defers booting the embedded nodejs-mobile Railgun engine to first focus since all tab bodies mount once at app boot. */
export function useWalletFocused(): boolean {
  return useTabFocused('/wallet');
}

/** True from the first moment the Contacts tab is focused, sticky thereafter. Gates the eager XMTP member walk in useAllContacts so it doesn't fire (and duplicate HomeScreen.sync's walk) on every cold start behind Home. */
export function useContactsFocused(): boolean {
  return useTabFocused('/contacts');
}
