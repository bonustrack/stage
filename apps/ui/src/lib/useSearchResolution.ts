
import { ref, watch, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { resolveSearchStep, type SearchResolution } from '@stage-labs/client/api/search';

export type { SearchResolution };

export function useSearchResolution(query: Ref<string>, router: Router): {
  searchResolution: Ref<SearchResolution>;
  openSearchedProfile: () => void;
} {
  const searchResolution = ref<SearchResolution>({ status: 'idle', address: null });

  watch(query, (q) => {
    const step = resolveSearchStep(q);
    if (step.kind === 'sync') { searchResolution.value = step.resolution; return; }
    searchResolution.value = { status: 'resolving', address: null };
    void step.resolve().then(res => {
      if (query.value.trim() !== step.query) return;
      searchResolution.value = res;
    });
  }, { flush: 'post' });

  function openSearchedProfile(): void {
    const addr = searchResolution.value.address;
    if (addr) void router.push(`/user/${addr}`);
  }

  return { searchResolution, openSearchedProfile };
}
