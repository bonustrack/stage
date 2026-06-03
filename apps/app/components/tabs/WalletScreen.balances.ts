/** Public-balance load + pull-to-refresh state for the Wallet tab. Extracted
 *  from WalletScreen for the lint line-budget. Owns the connected address, the
 *  fetched AssetRow[], the error string, and the pull-to-refresh spinner.
 *
 *  Pull-to-refresh re-runs the public balance fetch AND (when a private account
 *  is known) a fresh Railgun shielded-snapshot scan in parallel, holding the
 *  spinner until BOTH settle. refreshSnapshot pushes new balances into the cache
 *  store, which the usePrivateWallet subscription picks up — so the shielded
 *  rows update without this hook needing its return value. */

import { useCallback, useEffect, useState } from 'react';
import { getOrCreateXmtpClient } from '../../lib/xmtp';
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
export function useWalletBalances(privAccountId: string | null): WalletBalances {
  const [address, setAddress] = useState<string>('');
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const client = await getOrCreateXmtpClient('production');
        const addr = client.publicIdentity.identifier;
        if (cancelled) return;
        setAddress(addr);
        const next = await fetchAssetRows(addr);
        if (cancelled) return;
        setRows(next);
      } catch (e) {
        if (!cancelled) setErr((e as Error).message);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback((): void => {
    if (!address) return;
    setRefreshing(true);
    /** Belt-and-braces: even though the spinner is now a pure-JS overlay bound
     *  to `refreshing` (so it can't strand the way the native RefreshControl
     *  did), keep a hard 8s ceiling so a wedged RPC never leaves it spinning.
     *  The public fetch is awaited for the visible spinner; the Railgun
     *  shielded re-scan is fired in the BACKGROUND (it can take many seconds and
     *  pushes its result into the cache store, which the UI subscribes to) so it
     *  never holds the spinner hostage. */
    let done = false;
    const clear = (): void => { if (!done) { done = true; setRefreshing(false); } };
    const hardStop = setTimeout(clear, 8000);
    if (privAccountId) void refreshSnapshot(privAccountId).catch(() => {});
    void (async (): Promise<void> => {
      try {
        const next = await fetchAssetRows(address);
        setRows(next);
        setErr('');
      } catch (e) {
        setErr((e as Error).message);
      } finally {
        clearTimeout(hardStop);
        clear();
      }
    })();
  }, [address, privAccountId]);

  return { address, rows, err, refreshing, onRefresh };
}
