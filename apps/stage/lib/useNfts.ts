
import { useEffect, useRef, useState } from 'react';
import { getNftsAcrossChains, type Nft } from './opensea';

export interface NftState { nfts: Nft[] | null; nftStatus: 'idle' | 'loading' | 'ready' | 'error' }

export function useNfts(active: boolean, address?: string): NftState {
  const [nfts, setNfts] = useState<Nft[] | null>(null);
  const [nftStatus, setNftStatus] = useState<NftState['nftStatus']>('idle');
  const loadedAddrRef = useRef<string | null>(null);
  useEffect(() => {
    if (!active || !address || loadedAddrRef.current === address) return;
    loadedAddrRef.current = address;
    let cancelled = false;
    setNftStatus('loading');
    void (async (): Promise<void> => {
      try {
        const list = await getNftsAcrossChains(address);
        if (cancelled) return;
        setNfts(list); setNftStatus('ready');
      } catch { if (!cancelled) setNftStatus('error'); }
    })();
    return () => { cancelled = true; };
  }, [active, address]);
  return { nfts, nftStatus };
}
