
import { useQuery } from '@tanstack/react-query';
import {
  fetchGithubDiff, type GithubDiff, type GithubRef,
} from '@stage-labs/client/api/github';

export type { GithubDiff };

export function useGithubDiff(ref: GithubRef | null): {
  diff: GithubDiff | null; isLoading: boolean; isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['githubDiff', ref?.url ?? ''],
    queryFn: () => {
      if (ref === null) throw new Error('useGithubDiff: queryFn ran without a ref');
      return fetchGithubDiff(ref);
    },
    enabled: !!ref,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return { diff: data ?? null, isLoading, isError };
}
