
type GithubKind = 'repo' | 'pull' | 'issue';

export interface GithubRef {
  url: string;
  owner: string;
  repo: string;
  kind: GithubKind;
  number?: number;
}

const SEG = '[A-Za-z0-9._-]+';
const RE = new RegExp(
  `https?://github\\.com/(${SEG})/(${SEG})(?:/(pull|issues)/(\\d+))?`,
  'i',
);

const RESERVED = new Set([
  'orgs', 'sponsors', 'marketplace', 'features', 'topics', 'collections',
  'settings', 'notifications', 'explore', 'about', 'pricing', 'login',
]);

function kindOf(sub: string | undefined): GithubKind {
  if (sub === 'pull') return 'pull';
  if (sub === 'issues') return 'issue';
  return 'repo';
}

export function githubLinkOf(text?: string | null): GithubRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const owner = m[1];
  const rawRepo = m[2];
  if (owner === undefined || rawRepo === undefined) return null;
  if (RESERVED.has(owner.toLowerCase())) return null;
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  const num = m[4] ? Number(m[4]) : undefined;
  return { url: m[0], owner, repo, kind: kindOf(m[3]), number: num };
}
