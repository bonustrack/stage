import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';
import { fetchActivityAllChains, type ActivityRow } from '@stage-labs/client/api/etherscan';
import {
  ensurePeerProfiles, subscribePeerProfiles,
} from '@stage-labs/client/identity/peerProfiles';
import { getActiveAccount, accountEpoch } from './accounts';

export interface WalletActivity {
  rows: Ref<ActivityRow[]>;
  loading: Ref<boolean>;
  error: Ref<boolean>;
  profileVersion: Ref<number>;
}

export function useActivity(): WalletActivity {
  const rows = ref<ActivityRow[]>([]);
  const loading = ref<boolean>(false);
  const error = ref<boolean>(false);
  const profileVersion = ref<number>(0);
  let cancelled = false;
  let token = 0;

  const stale = (mine: number): boolean => cancelled || mine !== token;

  async function load(): Promise<void> {
    const mine = ++token;
    loading.value = true;
    error.value = false;
    try {
      const rec = await getActiveAccount();
      if (stale(mine)) return;
      const addr = rec?.address ?? '';
      if (!addr) { rows.value = []; loading.value = false; return; }
      const list = await fetchActivityAllChains(addr, 50);
      if (stale(mine)) return;
      rows.value = list;
      ensurePeerProfiles(list.map(r => r.counterparty));
    } catch {
      if (!stale(mine)) error.value = true;
    } finally {
      if (!stale(mine)) loading.value = false;
    }
  }

  const unsubscribe = subscribePeerProfiles(() => { profileVersion.value += 1; });

  onMounted(() => { void load(); });
  const stop = watch(accountEpoch, () => { void load(); });
  onUnmounted(() => { cancelled = true; stop(); unsubscribe(); });

  return { rows, loading, error, profileVersion };
}
