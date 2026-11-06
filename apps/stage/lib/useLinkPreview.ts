import { useQuery } from '@tanstack/react-query';
import { fetchLinkPreview, type LinkPreviewResult } from '@stage-labs/client/api/linkPreview';
import { linkProxyBase } from './linkProxy';

export const LINK_CARD_QUERY = {
  staleTime: 60 * 60_000,
  gcTime: 24 * 60 * 60_000,
  retry: false,
  refetchOnWindowFocus: false,
  refetchOnReconnect: false,
} as const;

export function useLinkPreview(url: string | null): LinkPreviewResult | null {
  const { data } = useQuery({
    queryKey: ['linkPreview', url ?? ''],
    queryFn: () => fetchLinkPreview(linkProxyBase(), url ?? ''),
    enabled: !!url,
    ...LINK_CARD_QUERY,
  });
  return data ?? null;
}
