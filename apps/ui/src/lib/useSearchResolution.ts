/** Shared search-box resolution for the Channels + Contacts tabs.
 *
 *  Watches the search `query` — when it contains a domain like `fabien.eth`,
 *  resolves it via Stamp so the page can render an "Open profile" suggestion
 *  below the list. Pure address inputs short-circuit (no resolution needed);
 *  anything else resets to idle. `openSearchedProfile` navigates to the
 *  resolved profile. Extracted from the two pages so the logic lives once. */

import { ref, watch, type Ref } from 'vue';
import type { Router } from 'vue-router';
import { isAddressLike, isDomainLike, resolveDomain } from './stamp';

export interface SearchResolution {
  status: 'idle' | 'resolving' | 'resolved' | 'missed';
  address: string | null;
}

/** Hook that resolves a search query domain to a profile and exposes navigation to it. */
export function useSearchResolution(query: Ref<string>, router: Router): {
  searchResolution: Ref<SearchResolution>;
  openSearchedProfile: () => void;
} {
  const searchResolution = ref<SearchResolution>({ status: 'idle', address: null });

  watch(query, (q) => {
    const v = q.trim();
    if (!v) { searchResolution.value = { status: 'idle', address: null }; return; }
    if (isAddressLike(v)) { searchResolution.value = { status: 'resolved', address: v }; return; }
    if (!isDomainLike(v)) { searchResolution.value = { status: 'idle', address: null }; return; }
    searchResolution.value = { status: 'resolving', address: null };
    void resolveDomain(v).then(addr => {
      /** Race protection — bail if the user kept typing. */
      if (query.value.trim() !== v) return;
      searchResolution.value = addr
        ? { status: 'resolved', address: addr }
        : { status: 'missed', address: null };
    });
  }, { flush: 'post' });

  /** Open Searched Profile. */
  function openSearchedProfile(): void {
    const addr = searchResolution.value.address;
    if (addr) void router.push(`/user/${addr}`);
  }

  return { searchResolution, openSearchedProfile };
}
