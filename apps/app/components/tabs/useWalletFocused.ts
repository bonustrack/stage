/**
 * @file useTabFocused hook: a sticky latch (derived from the router pathname) for whether a tab route has ever been the active pager page.
 *  Callers gate expensive one-time boot work on it (e.g. the Wallet Railgun engine), so it latches once true and never flips back.
 */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';

/**
 * Sticky "has this tab's route ever been the active pager page" latch. Matches
 *  the tab's base route (`/<tab>`) and its sub-routes (`/<tab>/*`) — the same
 *  rule the pager uses to pick index — and LATCHES once true: the expensive boot
 *  work a caller gates on this only needs to happen once, so we never flip back
 *  when the user swipes away. If the tab is never opened this stays false.
 */
export function useTabFocused(base: string): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);
  // Avoid a redundant setState once latched (the effect would otherwise re-run
  // on every pathname change for the rest of the session).
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

/**
 * True from the first moment the Wallet tab becomes the active pager page (or a
 *  /wallet/* sub-route is open), and stays true for the rest of the session.
 *  WHY this matters: every first-level tab body is mounted ONCE at app boot (the
 *  pager mounts all five side-by-side, see SwipeTabs.tsx), so a plain mount
 *  effect in WalletScreen would fire on EVERY app open — booting the embedded
 *  nodejs-mobile Railgun engine even when the user never opens Wallet. Gating on
 *  this latch defers that to first focus.
 */
export function useWalletFocused(): boolean {
  return useTabFocused('/wallet');
}

/** True from the first moment the Contacts tab is focused, sticky thereafter. Gates the eager XMTP member walk in useAllContacts so it doesn't fire (and duplicate HomeScreen.sync's walk) on every cold start behind Home. */
export function useContactsFocused(): boolean {
  return useTabFocused('/contacts');
}
