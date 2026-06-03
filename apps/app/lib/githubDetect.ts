/** GitHub link detection for message bubbles. Extracts the first github.com
 *  repo / PR / issue URL from message text so the bubble can render a rich
 *  preview card below the body. Pure string parsing — no network — so it stays
 *  cheap to run on every render and unit-testable. */

export type GithubKind = 'repo' | 'pull' | 'issue';

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

/** Detect the first github.com repo/PR/issue link in `text`, or null. */
export function githubLinkOf(text?: string | null): GithubRef | null {
  if (!text) return null;
  const m = RE.exec(text);
  if (!m) return null;
  const owner = m[1];
  let repo = m[2];
  if (RESERVED.has(owner.toLowerCase())) return null;
  // Strip a trailing .git and any stray punctuation the regex may have caught.
  repo = repo.replace(/\.git$/i, '');
  if (!owner || !repo) return null;
  const sub = m[3];
  const num = m[4] ? Number(m[4]) : undefined;
  const kind: GithubKind = sub === 'pull' ? 'pull' : sub === 'issues' ? 'issue' : 'repo';
  return { url: m[0], owner, repo, kind, number: num };
}
