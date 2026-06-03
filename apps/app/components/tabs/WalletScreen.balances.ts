/** Public-balance load + pull-to-refresh state for the Wallet tab. Extracted
 *  from WalletScreen for the lint line-budget. Owns the connected address, the
 *  fetched AssetRow[], the error string, and the pull-to-refresh spinner.
 *
 *  Pull-to-refresh kicks off BOTH the public balance fetch and (when a private
 *  account is known) a fresh Railgun shielded-snapshot scan as fire-and-forget
 *  background work, then dismisses the spinner on a short fixed delay (~700ms).
 *  The spinner is a brief visual ack only — it is NOT gated on any network call,
 *  so it can never linger. Rows update reactively: the public fetch calls
 *  setRows when it lands, and refreshSnapshot pushes into the cache store which
 *  the usePrivateWallet subscription picks up. */

import { useCallback, useEffect, useRef, useState } from 'react';
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
  const mounted = useRef(true);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    };
  }, []);

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

    /** Fire the public balance fetch in the background — DON'T await it. When it
     *  lands it updates the rows in place; the spinner is not gated on it. */
    void (async (): Promise<void> => {
      try {
        const next = await fetchAssetRows(address);
        if (!mounted.current) return;
        setRows(next);
        setErr('');
      } catch (e) {
        if (mounted.current) setErr((e as Error).message);
      }
    })();

    /** Fire the shielded (Railgun) re-scan in the background too. The engine path
     *  (nodejs-mobile bridge boot / Merkle scan) can be slow or hang; it updates
     *  the cache store, which usePrivateWallet picks up. */
    if (privAccountId) void refreshSnapshot(privAccountId).catch(() => {});

    /** Dismiss the spinner on a short fixed delay — purely a visual ack, never
     *  gated on a network call, so it always settles fast and can't linger. */
    if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    spinnerTimer.current = setTimeout(() => {
      if (mounted.current) setRefreshing(false);
    }, 700);
  }, [address, privAccountId]);

  return { address, rows, err, refreshing, onRefresh };
}
