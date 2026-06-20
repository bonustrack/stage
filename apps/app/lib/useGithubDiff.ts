
import { useQuery } from '@tanstack/react-query';
import type { GithubRef } from './githubDetect';
import { toDiffFile, type DiffFile } from './diffParse';

export interface GithubDiff {
  kind: 'ok' | 'no-pr';
  owner: string;
  repo: string;
  prNumber?: number;
  title?: string;
  body?: string;
  files: DiffFile[];
  additions: number;
  deletions: number;
}

const PROXY = 'https://blob.metro.box/gh/diff';
const GH = 'https://api.github.com';
const HEADERS = { Accept: 'application/vnd.github+json' };

interface ProxyResult {
  kind: 'ok' | 'no-pr';
  owner: string;
  repo: string;
  prNumber?: number;
  title?: string;
  body?: string;
  additions?: number;
  deletions?: number;
  files?: Record<string, unknown>[];
  error?: string;
}

function totalsOf(files: DiffFile[]): { additions: number; deletions: number } {
  return files.reduce(
    (acc, f) => ({ additions: acc.additions + f.additions, deletions: acc.deletions + f.deletions }),
    { additions: 0, deletions: 0 },
  );
}

async function fetchBody(owner: string, repo: string, kind: 'pull' | 'issue', n: number): Promise<string | undefined> {
  const path = kind === 'pull' ? 'pulls' : 'issues';
  try {
    const res = await fetch(`${GH}/repos/${owner}/${repo}/${path}/${n}`, { headers: HEADERS });
    if (!res.ok) return undefined;
    const j = (await res.json()) as { body?: string };
    return j.body ?? undefined;
  } catch { return undefined; }
}

async function noPrFromProxy(out: ProxyResult, ref: GithubRef): Promise<GithubDiff> {
  const body = out.body ?? (ref.number ? await fetchBody(out.owner, out.repo, 'issue', ref.number) : undefined);
  return { kind: 'no-pr', owner: out.owner, repo: out.repo, title: out.title, body, files: [], additions: 0, deletions: 0 };
}

async function okFromProxy(out: ProxyResult): Promise<GithubDiff> {
  const files = (out.files ?? []).map(toDiffFile);
  const summed = totalsOf(files);
  const body = out.body ?? (out.prNumber ? await fetchBody(out.owner, out.repo, 'pull', out.prNumber) : undefined);
  return {
    kind: 'ok', owner: out.owner, repo: out.repo, prNumber: out.prNumber,
    title: out.title, body, files,
    additions: typeof out.additions === 'number' ? out.additions : summed.additions,
    deletions: typeof out.deletions === 'number' ? out.deletions : summed.deletions,
  };
}

async function fetchViaProxy(ref: GithubRef): Promise<GithubDiff> {
  const qs = new URLSearchParams({
    owner: ref.owner, repo: ref.repo, kind: ref.kind, number: String(ref.number ?? 0),
  });
  const res = await fetch(`${PROXY}?${qs}`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`proxy ${res.status}`);
  const out = (await res.json()) as ProxyResult;
  if (out.error) throw new Error(out.error);
  if (out.kind === 'no-pr') return noPrFromProxy(out, ref);
  return okFromProxy(out);
}

function prNumberFromTimelineEvent(e: Record<string, unknown>): number | null {
  const src = e.source as { issue?: { number?: number; pull_request?: unknown } } | undefined;
  if (src?.issue?.pull_request && typeof src.issue.number === 'number') return src.issue.number;
  return null;
}

async function resolvePrNumber(ref: GithubRef): Promise<number | null> {
  if (ref.kind === 'pull' && ref.number) return ref.number;
  if (ref.kind !== 'issue' || !ref.number) return null;
  const url = `${GH}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}/timeline?per_page=100`;
  const res = await fetch(url, { headers: { ...HEADERS, Accept: 'application/vnd.github.mockingbird-preview+json' } });
  if (!res.ok) return null;
  const events = (await res.json()) as Record<string, unknown>[];
  let found: number | null = null;
  for (const e of events) {
    const n = prNumberFromTimelineEvent(e);
    if (n != null) found = n;
  }
  return found;
}

async function fetchDirect(ref: GithubRef): Promise<GithubDiff> {
  const prNumber = await resolvePrNumber(ref);
  if (prNumber == null) {
    let issue: { title?: string; body?: string } = {};
    if (ref.kind === 'issue' && ref.number) {
      const iRes = await fetch(`${GH}/repos/${ref.owner}/${ref.repo}/issues/${ref.number}`, { headers: HEADERS });
      if (iRes.ok) issue = (await iRes.json()) as { title?: string; body?: string };
    }
    return { kind: 'no-pr', owner: ref.owner, repo: ref.repo, title: issue.title, body: issue.body, files: [], additions: 0, deletions: 0 };
  }
  const base = `${GH}/repos/${ref.owner}/${ref.repo}/pulls/${prNumber}`;
  const [metaRes, filesRes] = await Promise.all([
    fetch(base, { headers: HEADERS }),
    fetch(`${base}/files?per_page=100`, { headers: HEADERS }),
  ]);
  const meta = metaRes.ok
    ? ((await metaRes.json()) as { title?: string; body?: string; additions?: number; deletions?: number })
    : {};
  const files = filesRes.ok
    ? ((await filesRes.json()) as Record<string, unknown>[]).map(toDiffFile)
    : [];
  const summed = totalsOf(files);
  return {
    kind: 'ok', owner: ref.owner, repo: ref.repo, prNumber,
    title: meta.title, body: meta.body, files,
    additions: typeof meta.additions === 'number' ? meta.additions : summed.additions,
    deletions: typeof meta.deletions === 'number' ? meta.deletions : summed.deletions,
  };
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
