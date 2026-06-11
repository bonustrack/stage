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

/** The Wallet tab is the `/wallet` route (the `(tabs)` group is path-transparent)
 *  and its sub-routes are `/wallet/*` — same rule the pager uses to pick index. */
function isWalletPath(pathname: string): boolean {
  return pathname === '/wallet' || pathname.startsWith('/wallet/');
}

/** True from the first moment the Wallet tab becomes the active pager page (or a
 *  /wallet/* sub-route is open), and stays true for the rest of the session. */
export function useWalletFocused(): boolean {
  const pathname = usePathname();
  const [everFocused, setEverFocused] = useState(false);
  // Avoid a redundant setState once latched (the effect would otherwise re-run
  // on every pathname change for the rest of the session).
  const latched = useRef(false);

  useEffect(() => {
    if (latched.current) return;
    if (isWalletPath(pathname)) {
      latched.current = true;
      setEverFocused(true);
    }
  }, [pathname]);

  return everFocused;
}
