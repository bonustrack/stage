
import { useQuery } from '@tanstack/react-query';
import { getNftsAcrossChains, type Nft } from '@stage-labs/client/api/opensea';

export interface NftState { nfts: Nft[] | null; nftStatus: 'idle' | 'loading' | 'ready' | 'error' }

export function useNfts(active: boolean, address?: string): NftState {
  const enabled = active && !!address;
  const { data, isError } = useQuery({
    queryKey: ['nfts', address ?? ''],
    queryFn: () => getNftsAcrossChains(address ?? ''),
    enabled,
  });
  if (isError) return { nfts: null, nftStatus: 'error' };
  if (data) return { nfts: data, nftStatus: 'ready' };
  return { nfts: null, nftStatus: enabled ? 'loading' : 'idle' };
}
