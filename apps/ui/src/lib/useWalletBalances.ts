import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { fetchAssetRows } from '@stage-labs/client/wallet/balances';
import type { AssetRow } from '@stage-labs/client/wallet/assets';
import { stampTokenUrl } from '@stage-labs/kit/avatar';
import { getActiveAccount, accountEpoch } from './accounts';

export interface WalletBalances {
  address: Ref<string>;
  rows: Ref<AssetRow[] | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  refresh: () => void;
}

export function useWalletBalances(): WalletBalances {
  const address = ref<string>('');
  const rows = ref<AssetRow[] | null>(null);
  const loading = ref<boolean>(false);
  const error = ref<string>('');
  let cancelled = false;
  let token = 0;

  const stale = (mine: number): boolean => cancelled || mine !== token;

  async function fetchInto(addr: string, mine: number): Promise<void> {
    if (!addr) { rows.value = []; return; }
    const next = await fetchAssetRows(addr, { tokenLogo: stampTokenUrl });
    if (stale(mine)) return;
    rows.value = next;
  }

  async function load(clear: boolean): Promise<void> {
    const mine = ++token;
    loading.value = true;
    error.value = '';
    if (clear) rows.value = null;
    try {
      const rec = await getActiveAccount();
      if (stale(mine)) return;
      address.value = rec?.address ?? '';
      await fetchInto(address.value, mine);
    } catch (e) {
      if (!stale(mine)) error.value = (e as Error).message;
    } finally {
      if (!stale(mine)) loading.value = false;
    }
  }

  function refresh(): void {
    void load(false);
  }

  onMounted(() => { void load(true); });
  const stop = watch(accountEpoch, () => { void load(true); });
  onUnmounted(() => { cancelled = true; stop(); });

  return { address, rows, loading, error, refresh };
}
