/** Public-balance load + pull-to-refresh state for the Wallet tab. Extracted
 *  from WalletScreen for the lint line-budget. Owns the connected address, the
 *  fetched AssetRow[], the error string, and the pull-to-refresh spinner.
 *
 *  Pull-to-refresh kicks off BOTH the public balance fetch and (when a private
 *  account is known) a fresh Railgun shielded-snapshot scan. The RefreshControl
 *  spinner is tied to the public fetch in a try/finally and capped by an 8s
 *  race, so it is dismissed by a real completion (sync with the native Android
 *  controlled spinner) and can NEVER linger — even if the fetch throws or the
 *  Railgun engine scan hangs (that scan is detached, the spinner never waits on
 *  it). Rows update reactively: refreshSnapshot pushes into the cache store which
 *  the usePrivateWallet subscription picks up. */

import { useCallback, useEffect, useRef, useState } from 'react';
import { getActiveAccount } from '../../lib/accounts';
import { useActiveAccount } from '../../modules/messaging';
import { refreshSnapshot } from '../../lib/railgun/wallet';
import { fetchAssetRows } from './WalletScreen.data';
import { type AssetRow } from './WalletScreen.assets';

export interface WalletBalances {
  address: string;
  rows: AssetRow[] | null;
  err: string;
  refreshing: boolean;
  onRefresh: () => void;
}

/** @param privAccountId  the active Railgun account id (from usePrivateWallet),
 *  or null when not yet known — its shielded snapshot is refreshed alongside
 *  the public balances on pull-to-refresh. */
/** @param focused  whether the Wallet tab has ever been focused (latched). The
 *  public multicall + CoinGecko fetch is skipped until first focus so it doesn't
 *  burst at every cold start behind Home (same gate as the Railgun engine boot
 *  in WalletScreen). */
export function useWalletBalances(privAccountId: string | null, focused: boolean): WalletBalances {
  const [address, setAddress] = useState<string>('');
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Re-derive on account switch (switchToAccount bumps this epoch). The address
   *  + balances were captured once on mount, so without this the Wallet tab kept
   *  showing the PREVIOUS account after a switch. */
  const accountEpoch = useActiveAccount();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    };
  }, []);

  useEffect(() => {
    // Defer the public balance burst until the Wallet tab is actually focused.
    if (!focused) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        /** Derive the EOA address straight from the active account record (NOT the
         *  XMTP client): the local wallet is decoupled from XMTP, switchToAccount
         *  repoints the active id before the inbox rebuilds, and this never hangs
         *  on a slow/failed Client.create. */
        const rec = await getActiveAccount();
        const addr = rec?.address ?? '';
        if (cancelled) return;
        setAddress(addr);
        // Clear the prior account's rows so we paint the spinner, not stale
        // balances, while the new account's balances load.
        setRows(null);
        setErr('');
        if (!addr) return;
        const next = await fetchAssetRows(addr);
        if (cancelled) return;
        setRows(next);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, [accountEpoch, focused]);

  const onRefresh = useCallback((): void => {
    if (!address) return;
    setRefreshing(true);
    /** Absolute backstop, fully independent of the fetch/race below: clear the
     *  visible spinner within 9s no matter what. The pure-JS pull-to-refresh
     *  overlay is bound to `refreshing`, but this guarantees the JS state never
     *  lingers even if the fetch wedges. */
    const hardStop = setTimeout(() => { if (mounted.current) setRefreshing(false); }, 9000);

    /** Always-resolving dismiss: the spinner is tied to the public fetch (the
     *  only fast, bounded call) AND a hard 8s safety cap that races it, so the
     *  spinner is dismissed by whichever lands first. The dismiss runs in a
     *  `finally`, so a thrown/rejected fetch can never strand the spinner. */
    const stop = (): void => {
      clearTimeout(hardStop);
      if (spinnerTimer.current) { clearTimeout(spinnerTimer.current); spinnerTimer.current = null; }
      if (mounted.current) setRefreshing(false);
    };

    /** Fire the Railgun shielded re-scan in the BACKGROUND (it can take many
     *  seconds and pushes its result into the cache store the UI subscribes to)
     *  so it never holds the spinner hostage. */
    if (privAccountId) void refreshSnapshot(privAccountId).catch(() => {/* noop */});

    void (async (): Promise<void> => {
      try {
        const next = await Promise.race([
          fetchAssetRows(address),
          new Promise<never>((_, rej) =>
            (spinnerTimer.current = setTimeout(() => { rej(new Error('refresh timeout')); }, 8000))),
        ]);
        if (!mounted.current) return;
        setRows(next);
        setErr('');
      } catch (e) {
        // A timeout is a spinner-cap only, not a balance error — keep the last
        // rows; surface a real fetch error string only for non-timeout failures.
        if (mounted.current && (e as Error).message !== 'refresh timeout') setErr((e as Error).message);
      } finally {
        stop();
      }
    })();
  }, [address, privAccountId]);

  return { address, rows, err, refreshing, onRefresh };
}
