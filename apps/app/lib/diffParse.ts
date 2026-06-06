/** Unified-diff parsing for the in-app PR diff viewer. The GitHub API returns a
 *  per-file `patch` string (a unified diff hunk body, no file headers) for each
 *  changed file in a PR. This module turns that raw patch into typed lines the
 *  FileDiff component can render GitHub-style (added / removed / context /
 *  hunk-header). Pure string work - no network - so it stays unit-testable. */

export type DiffLineKind = 'add' | 'del' | 'context' | 'hunk' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  /** The raw line text WITHOUT the leading +/-/space marker. */
  text: string;
}

export interface DiffFile {
  /** New path (or old path for a deletion). */
  filename: string;
  /** GitHub file status: added | removed | modified | renamed | ... */
  status: string;
  additions: number;
  deletions: number;
  /** Parsed patch lines; empty when GitHub omits the patch (binary / too big). */
  lines: DiffLine[];
  /** True when GitHub returned no patch body (binary file, or diff too large). */
  noPatch: boolean;
}

/** Parse one file's unified-diff `patch` body into typed lines. Hunk headers
 *  (@@ ... @@) and "\ No newline" markers are kept as their own kinds so the
 *  renderer can style them distinctly. */
export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  const out: DiffLine[] = [];
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      out.push({ kind: 'hunk', text: raw });
    } else if (raw.startsWith('+')) {
      out.push({ kind: 'add', text: raw.slice(1) });
    } else if (raw.startsWith('-')) {
      out.push({ kind: 'del', text: raw.slice(1) });
    } else if (raw.startsWith('\\')) {
      out.push({ kind: 'meta', text: raw });
    } else {
      // Leading space = context; a bare empty line is also context.
      out.push({ kind: 'context', text: raw.startsWith(' ') ? raw.slice(1) : raw });
    }
  }
  return out;
}

/** Shape a raw GitHub /pulls/{n}/files entry into a DiffFile. */
export function toDiffFile(entry: Record<string, unknown>): DiffFile {
  const patch = typeof entry.patch === 'string' ? entry.patch : '';
  return {
    filename: typeof entry.filename === 'string' ? entry.filename : '(unknown)',
    status: typeof entry.status === 'string' ? entry.status : 'modified',
    additions: typeof entry.additions === 'number' ? entry.additions : 0,
    deletions: typeof entry.deletions === 'number' ? entry.deletions : 0,
    lines: parsePatch(patch),
    noPatch: patch.length === 0,
  };
}
