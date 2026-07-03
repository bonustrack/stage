
import { useEffect, useState } from 'react';
import { fetchUsdPrice, fmtUsdValue } from '@stage-labs/client/wallet/prices';
import { priceKeyFor, priceKeyId } from './txAssets';

export function useUsdValue(
  chainId: number, token: string | null | undefined, amount: string | undefined,
): string | null {
  const [usd, setUsd] = useState<number | null>(null);
  const id = priceKeyId(priceKeyFor(chainId, token));
  useEffect(() => {
    if (!id) { setUsd(null); return; }
    let alive = true;
    void fetchUsdPrice(priceKeyFor(chainId, token)).then(p => { if (alive) setUsd(p); });
    return () => { alive = false; };
  }, [id, chainId, token]);
  if (!amount) return null;
  return fmtUsdValue(amount, usd);
}
