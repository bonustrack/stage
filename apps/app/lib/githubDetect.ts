/** @file Extracts the first github.com repo/PR/issue URL from message text (pure string parsing, no network) so a bubble can render a rich preview card. */

type GithubKind = 'repo' | 'pull' | 'issue';

export interface GithubRef {
  /** The matched github.com URL (used as the cache / query key). */
  url: string;
  owner: string;
  repo: string;
  kind: GithubKind;
  /** PR / issue number; undefined for a bare repo link. */
  number?: number;
}

/** owner/repo segments: GitHub allows alnum, dash, underscore, dot. */
const SEG = '[A-Za-z0-9._-]+';
const RE = new RegExp(
  `https?://github\\.com/(${SEG})/(${SEG})(?:/(pull|issues)/(\\d+))?`,
  'i',
);

/** Owner/repo path prefixes that are GitHub features, not real repos. */
const RESERVED = new Set([
  'orgs', 'sponsors', 'marketplace', 'features', 'topics', 'collections',
  'settings', 'notifications', 'explore', 'about', 'pricing', 'login',
]);

/** Map a regex `pull`/`issues` subpath token to a GithubKind (defaulting to `repo`). */
function kindOf(sub: string | undefined): GithubKind {
  if (sub === 'pull') return 'pull';
  if (sub === 'issues') return 'issue';
  return 'repo';
}

/** Detect the first github.com repo/PR/issue link in `text`, or null. */
export function githubLinkOf(text?: string | null): GithubRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const owner = m[1];
  const rawRepo = m[2];
  if (owner === undefined || rawRepo === undefined) return null;
  if (RESERVED.has(owner.toLowerCase())) return null;
  /** Strip a trailing .git and any stray punctuation the regex may have caught. */
  const repo = rawRepo.replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  const num = m[4] ? Number(m[4]) : undefined;
  return { url: m[0], owner, repo, kind: kindOf(m[3]), number: num };
}
