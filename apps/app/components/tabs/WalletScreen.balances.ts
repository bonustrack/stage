/** Public-balance load + pull-to-refresh state for the Wallet tab. Extracted
 *  from WalletScreen for the lint line-budget. Owns the connected address, the
 *  fetched AssetRow[], the error string, and the pull-to-refresh spinner.
 *
 *  Pull-to-refresh re-runs the public balance fetch and (when a private account
 *  is known) kicks off a fresh Railgun shielded-snapshot scan. The spinner is
 *  settled on the FAST public fetch only (with an 8s hard cap) — the slow/hangy
 *  engine scan runs in the background so it can never freeze the spinner.
 *  refreshSnapshot pushes new balances into the cache store, which the
 *  usePrivateWallet subscription picks up — so the shielded rows update without
 *  this hook needing its return value. */

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

    /** Fire the shielded (Railgun) re-scan but DON'T let the spinner wait on it.
     *  The engine path (nodejs-mobile bridge boot / Merkle scan) can be slow or
     *  hang outright; awaiting it kept the spinner stuck on screen. It updates
     *  the cache store in the background — usePrivateWallet picks it up. */
    if (privAccountId) void refreshSnapshot(privAccountId).catch(() => {});

    /** Settle the spinner on the FAST public fetch only, with an ~8s hard cap so
     *  a hanging RPC can never freeze the spinner indefinitely. try/finally
     *  guarantees setRefreshing(false) runs on success, error, AND timeout. */
    void (async (): Promise<void> => {
      try {
        const next = await Promise.race([
          fetchAssetRows(address),
          new Promise<never>((_, rej) =>
            setTimeout(() => rej(new Error('refresh timeout')), 8000)),
        ]);
        setRows(next);
        setErr('');
      } catch (e) {
        if ((e as Error).message !== 'refresh timeout') setErr((e as Error).message);
      } finally {
        setRefreshing(false);
      }
    })();
  }, [address, privAccountId]);

  return { address, rows, err, refreshing, onRefresh };
}
