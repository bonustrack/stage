import { useQuery } from '@tanstack/react-query';
import { fetchGithubMeta, type GithubMeta, type GithubRef } from '@stage-labs/client/api/github';
import { LINK_CARD_QUERY } from './useLinkPreview';

export function useGithubMeta(ref: GithubRef | null): GithubMeta | null {
  const { data } = useQuery({
    queryKey: ['githubMeta', ref?.url ?? ''],
    queryFn: () => {
      if (ref === null) throw new Error('useGithubMeta: queryFn ran without a ref');
      return fetchGithubMeta(ref);
    },
    enabled: !!ref,
    ...LINK_CARD_QUERY,
  });
  return data ?? null;
}
