
type DiffLineKind = 'add' | 'del' | 'context' | 'hunk' | 'meta';

export interface DiffLine {
  kind: DiffLineKind;
  text: string;
  oldLine: number | null;
  newLine: number | null;
}

export interface DiffFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  lines: DiffLine[];
  noPatch: boolean;
}

export function parsePatch(patch: string): DiffLine[] {
  if (!patch) return [];
  const out: DiffLine[] = [];
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
      out.push({ kind: 'context', text: raw.startsWith(' ') ? raw.slice(1) : raw, oldLine: oldNo++, newLine: newNo++ });
    }
  }
  return out;
}

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
