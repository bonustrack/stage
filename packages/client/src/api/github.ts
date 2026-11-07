type GithubKind = 'repo' | 'pull' | 'issue';

export interface GithubRef {
  url: string;
  owner: string;
  repo: string;
  kind: GithubKind;
  number?: number;
}

const SEG = '[A-Za-z0-9._-]+';
const RE = new RegExp(`https?://github\\.com/(${SEG})/(${SEG})(?:/(pull|issues)/(\\d+))?`, 'i');

const RESERVED = new Set([
  'orgs',
  'sponsors',
  'marketplace',
  'features',
  'topics',
  'collections',
  'settings',
  'notifications',
  'explore',
  'about',
  'pricing',
  'login',
]);

function kindOf(sub: string | undefined): GithubKind {
  if (sub === 'pull') return 'pull';
  if (sub === 'issues') return 'issue';
  return 'repo';
}

export function githubLinkOf(text?: string | null): GithubRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  const owner = m?.[1];
  const repo = m?.[2]?.replace(/\.git$/i, '');
  if (!m || !owner || !repo || RESERVED.has(owner.toLowerCase())) return null;
  return { url: m[0], owner, repo, kind: kindOf(m[3]), number: m[4] ? Number(m[4]) : undefined };
}

export interface GithubMeta {
  kind: GithubKind;
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

function repoMeta(j: Record<string, unknown>, repo: string): GithubMeta {
  return {
    kind: 'repo',
    title: typeof j.full_name === 'string' ? j.full_name : repo,
    repo,
    state: '',
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

function githubMetaOf(j: Record<string, unknown>, ref: GithubRef): GithubMeta {
  const repo = `${ref.owner}/${ref.repo}`;
  return ref.kind === 'repo' ? repoMeta(j, repo) : issueOrPullMeta(j, ref, repo);
}

export async function fetchGithubMeta(ref: GithubRef): Promise<GithubMeta | null> {
  try {
    const res = await fetch(metaPath(ref), { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) return null;
    return githubMetaOf((await res.json()) as Record<string, unknown>, ref);
  } catch {
    return null;
  }
}
