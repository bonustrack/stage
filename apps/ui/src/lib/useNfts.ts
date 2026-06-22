import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { getNftsAcrossChains, type Nft } from '@stage-labs/client/api/opensea';
import { getActiveAccount, accountEpoch } from './accounts';

export interface WalletNfts {
  nfts: Ref<Nft[] | null>;
  loading: Ref<boolean>;
  error: Ref<boolean>;
}

export function useNfts(): WalletNfts {
  const nfts = ref<Nft[] | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<boolean>(false);
  let cancelled = false;
  let token = 0;

  const stale = (mine: number): boolean => cancelled || mine !== token;

  async function load(): Promise<void> {
    const mine = ++token;
    loading.value = true;
    error.value = false;
    nfts.value = null;
    try {
      const rec = await getActiveAccount();
      if (stale(mine)) return;
      const addr = rec?.address ?? '';
      if (!addr) { nfts.value = []; loading.value = false; return; }
      const list = await getNftsAcrossChains(addr);
      if (stale(mine)) return;
      nfts.value = list;
    } catch {
      if (!stale(mine)) error.value = true;
    } finally {
      if (!stale(mine)) loading.value = false;
    }
  }

  onMounted(() => { void load(); });
  const stop = watch(accountEpoch, () => { void load(); });
  onUnmounted(() => { cancelled = true; stop(); });

  return { nfts, loading, error };
}
