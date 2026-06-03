/** TanStack Query hook fetching public GitHub metadata for a repo / PR / issue
 *  link so a message bubble can render a preview card. Uses the unauthenticated
 *  GitHub REST API (60 req/hr/IP) — so results are cached HARD (long staleTime +
 *  no refetch) keyed on the URL. On any failure (404 private, 403 rate-limit,
 *  network) the queryFn returns null and the caller renders no card. */

import { useQuery } from '@tanstack/react-query';
import type { GithubRef } from './githubDetect';

export interface GithubMeta {
  kind: GithubRef['kind'];
  title: string;
  /** owner/repo. */
  repo: string;
  number?: number;
  /** 'open' | 'closed' | 'merged' for PR/issue; '' for repo. */
  state: string;
  author?: string;
  description?: string;
  stars?: number;
}

async function fetchGithubMeta(ref: GithubRef): Promise<GithubMeta | null> {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  const path = ref.kind === 'pull'
    ? `${base}/pulls/${ref.number}`
    : ref.kind === 'issue'
      ? `${base}/issues/${ref.number}`
      : base;
  try {
    const res = await fetch(path, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const repo = `${ref.owner}/${ref.repo}`;
    if (ref.kind === 'repo') {
      const name = typeof j.full_name === 'string' ? j.full_name : repo;
      return {
        kind: 'repo', title: name, repo, state: '',
        description: typeof j.description === 'string' ? j.description : undefined,
        stars: typeof j.stargazers_count === 'number' ? j.stargazers_count : undefined,
      };
    }
    const merged = ref.kind === 'pull' && j.merged_at != null;
    const rawState = typeof j.state === 'string' ? j.state : 'open';
    const user = j.user as { login?: string } | undefined;
    return {
      kind: ref.kind,
      title: typeof j.title === 'string' ? j.title : repo,
      repo,
      number: ref.number,
      state: merged ? 'merged' : rawState,
      author: typeof user?.login === 'string' ? user.login : undefined,
    };
  } catch {
    return null;
  }
}

export function useGithubMeta(ref: GithubRef | null): GithubMeta | null {
  const { data } = useQuery({
    queryKey: ['githubMeta', ref?.url ?? ''],
    queryFn: () => fetchGithubMeta(ref as GithubRef),
    enabled: !!ref,
    // Cache hard: respect the 60/hr unauthed limit. No background refetch.
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? null;
}
