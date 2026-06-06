/** TanStack Query hook fetching a PR's per-file diff for the in-app diff viewer.
 *
 *  Given a parsed GitHub ref (owner/repo + pull/issue number) it asks the Metro
 *  daemon's authenticated GitHub proxy (blob.metro.box/gh/diff) to resolve the PR
 *  number, pull the PR meta + changed files (each with a unified-diff `patch`) and
 *  hand them back in ONE keyless round trip. The GitHub token stays server-side,
 *  so reads use the 5000 req/hr authenticated ceiling instead of the unauth
 *  60 req/hr/IP limit that left the viewer blank.
 *
 *  Issue links: an issue is not a PR, so the proxy resolves a linked PR via the
 *  issue's `timeline` (cross-referenced / connected PRs). If none is found it
 *  returns { kind: 'no-pr' } so the page can show a graceful message.
 *
 *  Fallback: if the proxy is unreachable the hook retries GitHub directly
 *  (unauthenticated) so the viewer still works off-daemon, just rate-limited. */

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

/** Authenticated daemon proxy: keeps the GitHub token server-side and lifts the
 *  rate limit to 5000 req/hr. Same host family as the blob upload proxy. */
const PROXY = 'https://blob.metro.box/gh/diff';
const GH = 'https://api.github.com';
const HEADERS = { Accept: 'application/vnd.github+json' };

/** Raw shape the proxy returns: same fields, but `files` are raw GitHub file
 *  objects (mapped to DiffFile client-side). `no-pr` carries no files. */
interface ProxyResult {
  kind: 'ok' | 'no-pr';
  owner: string;
  repo: string;
  prNumber?: number;
  title?: string;
  files?: Array<Record<string, unknown>>;
  error?: string;
}

/** Primary path: one authenticated round trip through the daemon proxy. */
async function fetchViaProxy(ref: GithubRef): Promise<GithubDiff> {
  const qs = new URLSearchParams({
    owner: ref.owner, repo: ref.repo, kind: ref.kind, number: String(ref.number ?? 0),
  });
  const res = await fetch(`${PROXY}?${qs}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const out = (await res.json()) as ProxyResult;
  if (out.error) throw new Error(out.error);
  if (out.kind === 'no-pr') return { kind: 'no-pr', owner: out.owner, repo: out.repo, files: [] };
  return {
    kind: 'ok', owner: out.owner, repo: out.repo, prNumber: out.prNumber,
    title: out.title, files: (out.files ?? []).map(toDiffFile),
  };
}

/** Resolve the PR number for an issue link via the issue timeline. Only used by
 *  the direct-GitHub fallback; the proxy does this server-side. */
async function resolvePrNumber(ref: GithubRef): Promise<number | null> {
  if (ref.kind === 'pull' && ref.number) return ref.number;
  if (ref.kind !== 'issue' || !ref.number) return null;
  const url = `${GH}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/timeline?per_page=100`;
  const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/vnd.github.mockingbird-preview+json' } });
  if (!res.ok) return null;
  const events = (await res.json()) as Array<Record<string, unknown>>;
  let found: number | null = null;
  for (const e of events) {
    const src = e.source as { issue?: { number?: number; pull_request?: unknown } } | undefined;
    if (src?.issue?.pull_request && typeof src.issue.number === 'number') found = src.issue.number;
  }
  return found;
}

/** Fallback path: hit GitHub directly (unauthenticated, 60 req/hr/IP). */
async function fetchDirect(ref: GithubRef): Promise<GithubDiff> {
  const prNumber = await resolvePrNumber(ref);
  if (prNumber == null) return { kind: 'no-pr', owner: ref.owner, repo: ref.repo, files: [] };
  const base = `${GH}/repos/${ref.owner}/${ref.repo}/pulls/${prNumber}`;
  const [metaRes, filesRes] = await Promise.all([
    fetch(base, { headers: HEADERS }),
    fetch(`${base}/files?per_page=100`, { headers: HEADERS }),
  ]);
  const title = metaRes.ok ? ((await metaRes.json()) as { title?: string }).title : undefined;
  const files = filesRes.ok
    ? ((await filesRes.json()) as Array<Record<string, unknown>>).map(toDiffFile)
    : [];
  return { kind: 'ok', owner: ref.owner, repo: ref.repo, prNumber, title, files };
}

async function fetchGithubDiff(ref: GithubRef): Promise<GithubDiff> {
  try { return await fetchViaProxy(ref); }
  catch { return await fetchDirect(ref); }
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
