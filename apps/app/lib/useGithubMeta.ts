
import { useQuery } from '@tanstack/react-query';
import type { GithubRef } from '@stage-labs/client/api/github';

export interface GithubMeta {
  kind: GithubRef['kind'];
  title: string;
  repo: string;
  number?: number;
  state: string;
  author?: string;
  description?: string;
  stars?: number;
  additions?: number;
  deletions?: number;
}

function metaPath(ref: GithubRef): string {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  if (ref.kind === 'pull') return `${base}/pulls/${ref.number}`;
  if (ref.kind === 'issue') return `${base}/issues/${ref.number}`;
  return base;
}

function repoMeta(j: Record<string, unknown>, ref: GithubRef, repo: string): GithubMeta {
  const name = typeof j.full_name === 'string' ? j.full_name : repo;
  return {
    kind: 'repo', title: name, repo, state: '',
    description: typeof j.description === 'string' ? j.description : undefined,
    stars: typeof j.stargazers_count === 'number' ? j.stargazers_count : undefined,
  };
}

function pullStats(j: Record<string, unknown>, ref: GithubRef): { additions?: number; deletions?: number } {
  if (ref.kind !== 'pull') return {};
  return {
    additions: typeof j.additions === 'number' ? j.additions : undefined,
    deletions: typeof j.deletions === 'number' ? j.deletions : undefined,
  };
}

function issueOrPullMeta(j: Record<string, unknown>, ref: GithubRef, repo: string): GithubMeta {
  const merged = ref.kind === 'pull' && j.merged_at != null;
  const rawState = typeof j.state === 'string' ? j.state : 'open';
  const user = j.user as { login?: string } | undefined;
  const stats = pullStats(j, ref);
  return {
    kind: ref.kind,
    title: typeof j.title === 'string' ? j.title : repo,
    repo,
    number: ref.number,
    state: merged ? 'merged' : rawState,
    author: typeof user?.login === 'string' ? user.login : undefined,
    additions: stats.additions,
    deletions: stats.deletions,
  };
}

async function fetchGithubMeta(ref: GithubRef): Promise<GithubMeta | null> {
  try {
    const res = await fetch(metaPath(ref), {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const j = (await res.json()) as Record<string, unknown>;
    const repo = `${ref.owner}/${ref.repo}`;
    return ref.kind === 'repo' ? repoMeta(j, ref, repo) : issueOrPullMeta(j, ref, repo);
  } catch {
    return null;
  }
}

export function useGithubMeta(ref: GithubRef | null): GithubMeta | null {
  const { data } = useQuery({
    queryKey: ['githubMeta', ref?.url ?? ''],
    queryFn: () => {
      if (ref === null) throw new Error('useGithubMeta: queryFn ran without a ref');
      return fetchGithubMeta(ref);
    },
    enabled: !!ref,
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? null;
}
