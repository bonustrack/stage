
import { useQuery } from '@tanstack/react-query';
import { decodeCall, type DecodedCall } from '@stage-labs/client/wallet/txDecode';

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
