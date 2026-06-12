/** Sticky "has the Wallet tab ever been the active pager page" signal.
 *
 *  WHY: every first-level tab body is mounted ONCE at app boot (the pager mounts
 *  all five side-by-side, see SwipeTabs.tsx), so a plain mount effect in
 *  WalletScreen fires on EVERY app open — even when the user never opens Wallet.
 *  That eagerly booted the embedded nodejs-mobile Railgun engine (a second Node
 *  VM + SQLCipher/leveldb/prover + a Sepolia getLogs catch-up scan) right after
 *  XMTP became ready, on every launch. The longer the app had been closed, the
 *  bigger the catch-up scan = the post-launch crawl.
 *
 *  This hook derives focus from the router pathname and LATCHES once true: the
 *  engine boot is the expensive part, so once it has happened there's no point
 *  tearing it down when the user swipes away — keep it warm. If the user never
 *  visits Wallet, this stays false forever and the engine never boots.
 *
 *  NB: we match the `/wallet` pathname directly rather than importing
 *  indexOfPathname/TAB_ORDER from SwipeTabs.config. That config imports
 *  WalletScreen, which imports this hook — pulling the config in here forms an
 *  import cycle, and at module-eval time TAB_ORDER is still undefined, so a
 *  top-level `TAB_ORDER.indexOf('wallet')` threw "Cannot read property 'indexOf'
 *  of undefined" at app launch. Matching the path inline keeps this leaf
 *  dependency-free. */
import { useEffect, useRef, useState } from 'react';
import { usePathname } from 'expo-router';

/** Sticky "has this tab's route ever been the active pager page" latch. Matches
 *  the tab's base route (`/<tab>`) and its sub-routes (`/<tab>/*`) — the same
 *  rule the pager uses to pick index — and LATCHES once true: the expensive boot
 *  work a caller gates on this only needs to happen once, so we never flip back
 *  when the user swipes away. If the tab is never opened this stays false. */
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

/** True from the first moment the Wallet tab becomes the active pager page (or a
 *  /wallet/* sub-route is open), and stays true for the rest of the session.
 *  WHY this matters: every first-level tab body is mounted ONCE at app boot (the
 *  pager mounts all five side-by-side, see SwipeTabs.tsx), so a plain mount
 *  effect in WalletScreen would fire on EVERY app open — booting the embedded
 *  nodejs-mobile Railgun engine even when the user never opens Wallet. Gating on
 *  this latch defers that to first focus. */
export function useWalletFocused(): boolean {
  return useTabFocused('/wallet');
}

/** True from the first moment the Contacts tab is focused, sticky thereafter.
 *  Gates the eager XMTP member walk in useAllContacts so it doesn't fire (and
 *  duplicate HomeScreen.sync's walk) on every cold start behind Home. */
export function useContactsFocused(): boolean {
  return useTabFocused('/contacts');
}
