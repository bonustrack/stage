/** @file Standalone module holding the single shared TanStack Query client (via `getQueryClient()`) so imperative non-React call sites read/write the same cache the React tree renders from. */

/** App-wide TanStack Query client in its own module so non-React call sites read/write the same cache the React tree renders; live XMTP streams stay outside Query but feed it (metadata events invalidate convMeta, channels-cache writes mirror into the channels key) to revalidate only observed data. */

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
