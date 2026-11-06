import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { fetchWalletPortfolio, type WalletPortfolio } from '@stage-labs/client/wallet/balances';
import { stampTokenUrl } from '@stage-labs/kit/avatar';

export function useWalletPortfolio(address: string, enabled: boolean): UseQueryResult<WalletPortfolio> {
  const queryClient = useQueryClient();
  const queryKey = ['walletPortfolio', address.toLowerCase()];
  return useQuery({
    queryKey,
    queryFn: () => fetchWalletPortfolio(address, { tokenLogo: stampTokenUrl }, queryClient.getQueryData(queryKey) !== undefined),
    enabled: enabled && !!address,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
}
