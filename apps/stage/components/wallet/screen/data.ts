import { useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query';
import { fetchWalletPortfolio, type WalletPortfolio } from '@stage-labs/client/wallet/balances';

export function useWalletPortfolio(address: string, enabled: boolean): UseQueryResult<WalletPortfolio> {
  const queryClient = useQueryClient();
  const queryKey = ['walletPortfolio', address.toLowerCase()];
  return useQuery({
    queryKey,
    queryFn: async () => {
      const { priceError, ...portfolio } = await fetchWalletPortfolio(address);
      if (priceError !== undefined && queryClient.getQueryData(queryKey) !== undefined) throw priceError;
      return portfolio;
    },
    enabled: enabled && !!address,
    staleTime: 60_000,
    refetchInterval: enabled ? 60_000 : false,
    retry: false,
  });
}
