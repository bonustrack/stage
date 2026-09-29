
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAssetRows as sdkFetchAssetRows } from '@stage-labs/client/wallet/balances';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@stage-labs/kit/avatar';
import { getCurrentPrices } from '@stage-labs/client/api/defillama';
import type { BalancePrices } from './balance.model';

export function useBalancePrices(enabled: boolean): UseQueryResult<BalancePrices> {
  return useQuery({
    queryKey: ['walletBalancePrices'],
    queryFn: async () => {
      const prices = await getCurrentPrices(['coingecko:ethereum', 'coingecko:bitcoin']);
      return { ethereum: prices['coingecko:ethereum'], bitcoin: prices['coingecko:bitcoin'] };
    },
    enabled,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
}

export function fetchAssetRows(addr: string): Promise<AssetRow[]> {
  return sdkFetchAssetRows(addr, { tokenLogo: stampTokenUrl });
}

export function useAssetRows(address: string, enabled = true): UseQueryResult<AssetRow[]> {
  return useQuery({
    queryKey: ['assetRows', address.toLowerCase()],
    queryFn: () => fetchAssetRows(address),
    enabled: enabled && !!address,
    staleTime: 0,
  });
}
