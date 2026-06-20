/** @file TanStack Query hook fetching public GitHub metadata for a repo/PR/issue link so a bubble can render a preview card; uses the unauthenticated REST API with hard URL-keyed caching, returning null on any failure. */

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
  /** PR only: lines added / removed. */
  additions?: number;
  deletions?: number;
}

/** The GitHub REST path for a ref's metadata (repo, pull, or issue). */
function metaPath(ref: GithubRef): string {
  const base = `https://api.github.com/repos/${ref.owner}/${ref.repo}`;
  if (ref.kind === 'pull') return `${base}/pulls/${ref.number}`;
  if (ref.kind === 'issue') return `${base}/issues/${ref.number}`;
  return base;
}

/** Map a repo API payload to GithubMeta. */
function repoMeta(j: Record<string, unknown>, ref: GithubRef, repo: string): GithubMeta {
  const name = typeof j.full_name === 'string' ? j.full_name : repo;
  return {
    kind: 'repo', title: name, repo, state: '',
    description: typeof j.description === 'string' ? j.description : undefined,
    stars: typeof j.stargazers_count === 'number' ? j.stargazers_count : undefined,
  };
}

/** PR-only added/removed line counts; undefined for issues or when absent. */
function pullStats(j: Record<string, unknown>, ref: GithubRef): { additions?: number; deletions?: number } {
  if (ref.kind !== 'pull') return {};
  return {
    additions: typeof j.additions === 'number' ? j.additions : undefined,
    deletions: typeof j.deletions === 'number' ? j.deletions : undefined,
  };
}

/** Map a PR/issue API payload to GithubMeta (PR-only fields gated on kind). */
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

/** Get the Github Meta. */
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

/** Hook fetching cached metadata (title, stats) for a GitHub ref. */
export function useGithubMeta(ref: GithubRef | null): GithubMeta | null {
  const { data } = useQuery({
    queryKey: ['githubMeta', ref?.url ?? ''],
    queryFn: () => {
      if (ref === null) throw new Error('useGithubMeta: queryFn ran without a ref');
      return fetchGithubMeta(ref);
    },
    enabled: !!ref,
    /** Cache hard: respect the 60/hr unauthed limit. No background refetch. */
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return data ?? null;
}
