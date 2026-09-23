import { useQuery } from '@tanstack/react-query';
import { priceKeyFor, priceKeyId, tokenStampArgs } from '@stage-labs/client/wallet/tokens';
import { fetchUsdPrice, fmtUsdValue } from '@stage-labs/client/wallet/prices';
import { decodeCall, type DecodedCall } from '@stage-labs/client/wallet/txDecode';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

export function tokenLogoUrl(
  chainId: number, token: string | null | undefined, displayPx: number,
): string {
  const { chainId: c, contract } = tokenStampArgs(chainId, token);
  return stampTokenUrl(c, contract, displayPx);
}

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

export function useDecodedCall(
  to: string | undefined, data: string | undefined, chainId: number,
): { call: DecodedCall | null; pending: boolean } {
  const hasData = !!data && data !== '0x' && data.length > 2;
  const { data: call, isPending } = useQuery({
    queryKey: ['decodedCall', chainId, to ?? '', data ?? ''],
    queryFn: () => decodeCall(to, data, chainId),
    enabled: hasData,
    staleTime: Infinity,
  });
  return { call: call ?? null, pending: hasData && isPending };
}
