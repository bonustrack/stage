/** @file Parses a GitHub per-file unified-diff `patch` body into typed add/del/context/hunk lines for the in-app PR diff viewer (pure, no network). */

type DiffLineKind = 'add' | 'del' | 'context' | 'hunk' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  /** The raw line text WITHOUT the leading +/-/space marker. */
  text: string;
  /** Old-file line number (del/context lines). Null for adds, hunk, meta. */
  oldLine: number | null;
  /** New-file line number (add/context lines). Null for dels, hunk, meta. */
  newLine: number | null;
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

/** Parse one file's unified-diff `patch` body into typed lines. Hunk headers (@@ ... @@) and "\ No newline" markers are kept as their own kinds so the renderer can style them distinctly. */
export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  const out: DiffLine[] = [];
  // Running old/new line counters, (re)seeded by each @@ -a,b +c,d @@ header.
  let oldNo = 0;
  let newNo = 0;
  for (const raw of patch.split('\n')) {
    if (raw.startsWith('@@')) {
      const m = /@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(raw);
      if (m) {
        oldNo = Number(m[1]);
        newNo = Number(m[2]);
      }
      out.push({ kind: 'hunk', text: raw, oldLine: null, newLine: null });
    } else if (raw.startsWith('+')) {
      out.push({ kind: 'add', text: raw.slice(1), oldLine: null, newLine: newNo++ });
    } else if (raw.startsWith('-')) {
      out.push({ kind: 'del', text: raw.slice(1), oldLine: oldNo++, newLine: null });
    } else if (raw.startsWith('\\')) {
      out.push({ kind: 'meta', text: raw, oldLine: null, newLine: null });
    } else {
      // Leading space = context; a bare empty line is also context.
      out.push({ kind: 'context', text: raw.startsWith(' ') ? raw.slice(1) : raw, oldLine: oldNo++, newLine: newNo++ });
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
