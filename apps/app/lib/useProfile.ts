/** TanStack Query hook for a single Snapshot profile (request/response data —
 *  cached + deduped + stale-while-revalidate across every screen that needs the
 *  same address). Live XMTP data (channels list, conversation feed) stays on its
 *  own streaming path; Query is only for fetched data. */

import { useQuery } from '@tanstack/react-query';
import { readProfile } from './profile';

export function useProfileQuery(address?: string | null) {
  const addr = (address ?? '').toLowerCase();
  return useQuery({
    queryKey: ['profile', addr],
    queryFn: () => readProfile(address as string),
    enabled: !!address,
  });
}
