/** App-wide TanStack Query client, in its OWN module so non-React call sites
 *  (XMTP stream wiring, cache bridges) can read/write the SAME cache the React
 *  tree renders from. `_layout.tsx` mounts this instance via QueryClientProvider;
 *  imperative code reaches it through `getQueryClient()`.
 *
 *  Live XMTP streams stay OUTSIDE Query (they're push, not fetch) but they FEED
 *  Query: a new group-metadata event invalidates that conv's convMeta key, and
 *  channels-cache writes mirror into the channels key (see modules/messaging/
 *  queries.ts). Query then revalidates only the data a mounted screen observes. */

import { QueryClient } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 60_000, gcTime: 30 * 60_000, retry: 1, refetchOnWindowFocus: false },
  },
});

/** The single shared client. Stable for the process lifetime. */
export function getQueryClient(): QueryClient {
  return queryClient;
}
