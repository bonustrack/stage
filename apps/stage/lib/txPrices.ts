
import { useQuery } from '@tanstack/react-query';
import { fetchUsdPrice, fmtUsdValue } from '@stage-labs/client/wallet/prices';
import { priceKeyFor, priceKeyId } from './txAssets';

export function useUsdValue(
  chainId: number, token: string | null | undefined, amount: string | undefined,
): string | null {
  const id = priceKeyId(priceKeyFor(chainId, token));
  const { data: usd } = useQuery({
    queryKey: ['usdPrice', id],
    queryFn: () => fetchUsdPrice(priceKeyFor(chainId, token)),
    enabled: !!id,
  });
  if (!amount) return null;
  return fmtUsdValue(amount, usd ?? null);
}
