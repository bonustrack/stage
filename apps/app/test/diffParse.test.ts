
import { describe, expect, test } from 'bun:test';
import { parsePatch, toDiffFile } from '../lib/diffParse';

const patch = [
  '@@ -1,3 +1,4 @@',
  ' context line',
  '-removed line',
  '+added line one',
  '+added line two',
  '\\ No newline at end of file',
].join('\n');

describe('parsePatch', () => {
  test('classifies hunk / context / del / add / meta lines and strips markers', () => {
    const lines = parsePatch(patch);
    expect(lines.map(l => l.kind)).toEqual(['hunk', 'context', 'del', 'add', 'add', 'meta']);
    expect(lines[1]).toEqual({ kind: 'context', text: 'context line', oldLine: 1, newLine: 1 });
    expect(lines[2]).toEqual({ kind: 'del', text: 'removed line', oldLine: 2, newLine: null });
    expect(lines[3]).toEqual({ kind: 'add', text: 'added line one', oldLine: null, newLine: 2 });
    expect(lines[4]).toEqual({ kind: 'add', text: 'added line two', oldLine: null, newLine: 3 });
  });

  test('empty patch yields no lines', () => {
    expect(parsePatch('')).toEqual([]);
  });
});

describe('toDiffFile', () => {
  test('shapes a GitHub files entry with defaults for missing fields', () => {
    const f = toDiffFile({ filename: 'a.ts', status: 'modified', additions: 2, deletions: 1, patch });
    expect(f.filename).toBe('a.ts');
    expect(f.additions).toBe(2);
    expect(f.noPatch).toBe(false);
    expect(f.lines.length).toBe(6);
  });

  test('flags noPatch when GitHub omits the patch (binary / too large)', () => {
    const f = toDiffFile({ filename: 'img.png', status: 'added' });
    expect(f.noPatch).toBe(true);
    expect(f.lines).toEqual([]);
    expect(f.additions).toBe(0);
  });
});
