/** TanStack Query hook fetching a PR's per-file diff for the in-app diff viewer.
 *  Given a parsed GitHub ref (owner/repo + pull/issue number) it resolves the PR
 *  number, then pulls the changed files (each with a unified-diff `patch`) from
 *  the unauthenticated GitHub REST API. Cached hard (60 req/hr/IP limit).
 *
 *  Issue links: an issue is not a PR, so we try to resolve a linked PR via the
 *  issue's `timeline` (cross-referenced / connected PRs). If none is found the
 *  hook returns { kind: 'no-pr' } so the page can show a graceful message. */

import { useQuery } from '@tanstack/react-query';
import type { GithubRef } from './githubDetect';
import { toDiffFile, type DiffFile } from './diffParse';

export interface GithubDiff {
  /** 'ok' = files resolved; 'no-pr' = link is an issue with no linked PR. */
  kind: 'ok' | 'no-pr';
  owner: string;
  repo: string;
  /** Resolved PR number (present when kind === 'ok'). */
  prNumber?: number;
  title?: string;
  files: DiffFile[];
}

const GH = 'https://api.github.com';
const HEADERS = { Accept: 'application/vnd.github+json' };

/** Resolve the PR number to diff for `ref`. Pull links resolve directly; issue
 *  links are searched for a connected/closing PR via the issue timeline. */
async function resolvePrNumber(ref: GithubRef): Promise<number | null> {
  if (ref.kind === 'pull' && ref.number) return ref.number;
  if (ref.kind !== 'issue' || !ref.number) return null;
  const url = `${GH}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/timeline?per_page=100`;
  const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/vnd.github.mockingbird-preview+json' } });
  if (!res.ok) return null;
  const events = (await res.json()) as Array<Record<string, unknown>>;
  // Prefer a "closed by PR" / cross-referenced PR. Walk newest-last so the most
  // recent linked PR wins.
  let found: number | null = null;
  for (const e of events) {
    const src = e.source as { issue?: { number?: number; pull_request?: unknown } } | undefined;
    if (src?.issue?.pull_request && typeof src.issue.number === 'number') found = src.issue.number;
  }
  return found;
}

async function fetchGithubDiff(ref: GithubRef): Promise<GithubDiff> {
  const prNumber = await resolvePrNumber(ref);
  if (prNumber == null) return { kind: 'no-pr', owner: ref.owner, repo: ref.repo, files: [] };

  const base = `${GH}/repos/${ref.owner}/${ref.repo}/pulls/${prNumber}`;
  const [metaRes, filesRes] = await Promise.all([
    fetch(base, { headers: HEADERS }),
    fetch(`${base}/files?per_page=100`, { headers: HEADERS }),
  ]);
  const title = metaRes.ok
    ? ((await metaRes.json()) as { title?: string }).title
    : undefined;
  const files = filesRes.ok
    ? ((await filesRes.json()) as Array<Record<string, unknown>>).map(toDiffFile)
    : [];
  return { kind: 'ok', owner: ref.owner, repo: ref.repo, prNumber, title, files };
}

export function useGithubDiff(ref: GithubRef | null): {
  diff: GithubDiff | null; isLoading: boolean; isError: boolean;
} {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['githubDiff', ref?.url ?? ''],
    queryFn: () => fetchGithubDiff(ref as GithubRef),
    enabled: !!ref,
    staleTime: 10 * 60_000,
    gcTime: 60 * 60_000,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return { diff: data ?? null, isLoading, isError };
}
