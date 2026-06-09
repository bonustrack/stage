/**
 * Tests for src/secure-fs.ts: credential files must end up 0600 and the
 * containing dir 0700, idempotently, without ever altering CONTENT.
 */

import { describe, expect, test } from 'bun:test';
import { mkdtempSync, statSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chmodIfExists, ensureSecureDir, writeSecure } from '../src/secure-fs.js';

const mode = (p: string): number => statSync(p).mode & 0o777;
const tmp = (): string => mkdtempSync(join(tmpdir(), 'metro-secfs-'));

describe('secure-fs', () => {
  test('writeSecure writes content at 0600 and dir at 0700', () => {
    const dir = join(tmp(), 'sub');
    const file = join(dir, 'creds.json');
    writeSecure(file, '{"a":1}');
    expect(readFileSync(file, 'utf8')).toBe('{"a":1}');
    expect(mode(file)).toBe(0o600);
    expect(mode(dir)).toBe(0o700);
  });

  test('chmodIfExists tightens an existing 0644 file to 0600, content unchanged', () => {
    const dir = tmp();
    const file = join(dir, 'leak.json');
    writeFileSync(file, 'SECRET', { mode: 0o644 });
    expect(mode(file)).toBe(0o644);
    chmodIfExists(file);
    expect(mode(file)).toBe(0o600);
    expect(readFileSync(file, 'utf8')).toBe('SECRET');
  });

  test('chmodIfExists is a no-op on a missing file', () => {
    expect(() => chmodIfExists(join(tmp(), 'nope.json'))).not.toThrow();
  });

  test('writeSecure is idempotent and overwrites cleanly', () => {
    const file = join(tmp(), 'creds.json');
    writeSecure(file, 'one');
    writeSecure(file, 'two');
    expect(readFileSync(file, 'utf8')).toBe('two');
    expect(mode(file)).toBe(0o600);
  });

  test('ensureSecureDir forces an existing loose dir to 0700', () => {
    const dir = join(tmp(), 'd');
    mkdtempSync(join(tmpdir(), 'x-')); // noise
    writeFileSync(join(tmp(), 'placeholder'), '');
    ensureSecureDir(dir);
    expect(mode(dir)).toBe(0o700);
    ensureSecureDir(dir); // idempotent
    expect(mode(dir)).toBe(0o700);
  });
});
