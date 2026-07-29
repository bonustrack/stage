
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { fetchAssetRows as sdkFetchAssetRows } from '@stage-labs/client/wallet/balances';
import { type AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

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
