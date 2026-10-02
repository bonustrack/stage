import { useQuery } from '@tanstack/react-query';
import { simulateTx, type SimulateResult } from '@stage-labs/client/wallet/txSimulate';
import { getActiveAccount } from './accounts';

export function useTxSimulation(
  to: string | undefined,
  data: string | undefined,
  value: string | undefined,
  chainId: number,
): { result: SimulateResult | null; pending: boolean } {
  const { data: result, isPending } = useQuery({
    queryKey: ['txSimulate', chainId, to ?? '', data ?? '', value ?? ''],
    queryFn: async (): Promise<SimulateResult> => {
      const from = (await getActiveAccount())?.address;
      if (!from) {
        return { success: 'unknown', assetChanges: { in: [], out: [] }, error: 'No active wallet' };
      }
      return simulateTx({ from, to: to ?? '', data, value, chainId });
    },
    enabled: !!to,
    staleTime: 0,
    gcTime: 0,
  });
  return { result: result ?? null, pending: !!to && isPending };
}
