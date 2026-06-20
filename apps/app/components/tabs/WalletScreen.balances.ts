
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

export function useWalletBalances(privAccountId: string | null, focused: boolean): WalletBalances {
  const [address, setAddress] = useState<string>('');
  const [rows, setRows] = useState<AssetRow[] | null>(null);
  const [err, setErr] = useState<string>('');
  const [refreshing, setRefreshing] = useState(false);
  const mounted = useRef(true);
  const spinnerTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const accountEpoch = useActiveAccount();

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      if (spinnerTimer.current) clearTimeout(spinnerTimer.current);
    };
  }, []);

  useEffect(() => {
    if (!focused) return;
    let cancelled = false;
    void (async (): Promise<void> => {
      try {
        const rec = await getActiveAccount();
        const addr = rec?.address ?? '';
        if (cancelled) return;
        setAddress(addr);
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
    const hardStop = setTimeout(() => { if (mounted.current) setRefreshing(false); }, 9000);

    const stop = (): void => {
      clearTimeout(hardStop);
      if (spinnerTimer.current) { clearTimeout(spinnerTimer.current); spinnerTimer.current = null; }
      if (mounted.current) setRefreshing(false);
    };

    if (privAccountId) void refreshSnapshot(privAccountId).catch(() => undefined);

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
        if (mounted.current && (e as Error).message !== 'refresh timeout') setErr((e as Error).message);
      } finally {
        stop();
      }
    })();
  }, [address, privAccountId]);

  return { address, rows, err, refreshing, onRefresh };
}
