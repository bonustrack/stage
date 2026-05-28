/**
 * Unit tests for `loadMetroEnv` precedence (src/paths.ts).
 *
 * Precedence (first-set wins):
 *   process.env  >  <cwd>/.env  >  ~/.metro/.env  >  $METRO_CONFIG_DIR/.env
 *
 * `paths.ts` resolves CONFIG_DIR / ~/.metro / cwd ONCE at import time, so we
 * exercise the real ordering in a *fresh* Node subprocess per case, with HOME,
 * cwd, and METRO_CONFIG_DIR all redirected into a temp tree. The real
 * ~/.metro/.env and ~/.config/metro/.env are never touched.
 *
 * `readDotenv` (the line/quote parser underneath) is tested in-process directly.
 */

import { describe, expect, test, afterAll } from 'bun:test';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readDotenv } from '../src/paths.ts';

const ROOT = new URL('..', import.meta.url).pathname;
const PATHS_JS = join(ROOT, 'dist', 'paths.js');

const tempRoots: string[] = [];
function freshDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'metro-env-'));
  tempRoots.push(d);
  return d;
}
afterAll(() => {
  for (const d of tempRoots) try { rmSync(d, { recursive: true, force: true }); } catch { /* ignore */ }
});

/**
 * Build a sandbox dir tree:
 *   <root>/home/.metro/.env        (TRAINS_ENV_FILE — HOME redirected here)
 *   <root>/home/.config/metro/.env (CONFIG dir default; we set METRO_CONFIG_DIR explicitly)
 *   <root>/cwd/.env                (cwd/.env)
 * then run dist/paths.js → loadMetroEnv() in a fresh process and read back the
 * resolved value of the requested keys.
 */
function runLoadEnv(opts: {
  cwdEnv?: Record<string, string>;
  trainsEnv?: Record<string, string>;
  configEnv?: Record<string, string>;
  processEnv?: Record<string, string>;
  keys: string[];
}): Record<string, string | null> {
  const root = freshDir();
  const home = join(root, 'home');
  const cwd = join(root, 'cwd');
  const configDir = join(home, '.config', 'metro');
  const stateDir = join(root, 'state');
  mkdirSync(cwd, { recursive: true });
  mkdirSync(join(home, '.metro'), { recursive: true });
  mkdirSync(configDir, { recursive: true });
  mkdirSync(stateDir, { recursive: true });

  const dump = (p: string, env?: Record<string, string>): void => {
    if (!env) return;
    writeFileSync(p, Object.entries(env).map(([k, v]) => `${k}=${v}`).join('\n') + '\n');
  };
  dump(join(cwd, '.env'), opts.cwdEnv);
  dump(join(home, '.metro', '.env'), opts.trainsEnv);
  dump(join(configDir, '.env'), opts.configEnv);

  /** Minimal driver: import the built module, run loadMetroEnv, print requested keys. */
  const driver = `
    import { loadMetroEnv } from ${JSON.stringify(PATHS_JS)};
    loadMetroEnv();
    const keys = ${JSON.stringify(opts.keys)};
    const out = {};
    for (const k of keys) out[k] = process.env[k] ?? null;
    process.stdout.write(JSON.stringify(out));
  `;
  const r = spawnSync('node', ['--input-type=module', '-e', driver], {
    cwd,
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      HOME: home,
      METRO_CONFIG_DIR: configDir,
      METRO_STATE_DIR: stateDir,
      XDG_CONFIG_HOME: '',
      ...(opts.processEnv ?? {}),
    },
  });
  if (r.status !== 0) throw new Error(`driver failed (${r.status}): ${r.stderr}`);
  return JSON.parse(r.stdout);
}

describe('loadMetroEnv precedence', () => {
  test('process.env beats every file', () => {
    const out = runLoadEnv({
      processEnv: { TOKEN: 'from-process' },
      cwdEnv: { TOKEN: 'from-cwd' },
      trainsEnv: { TOKEN: 'from-trains' },
      configEnv: { TOKEN: 'from-config' },
      keys: ['TOKEN'],
    });
    expect(out.TOKEN).toBe('from-process');
  });

  test('cwd/.env beats ~/.metro/.env and config', () => {
    const out = runLoadEnv({
      cwdEnv: { TOKEN: 'from-cwd' },
      trainsEnv: { TOKEN: 'from-trains' },
      configEnv: { TOKEN: 'from-config' },
      keys: ['TOKEN'],
    });
    expect(out.TOKEN).toBe('from-cwd');
  });

  test('~/.metro/.env beats config/.env', () => {
    const out = runLoadEnv({
      trainsEnv: { TOKEN: 'from-trains' },
      configEnv: { TOKEN: 'from-config' },
      keys: ['TOKEN'],
    });
    expect(out.TOKEN).toBe('from-trains');
  });

  test('config/.env is the last resort', () => {
    const out = runLoadEnv({ configEnv: { TOKEN: 'from-config' }, keys: ['TOKEN'] });
    expect(out.TOKEN).toBe('from-config');
  });

  test('unset everywhere → null', () => {
    const out = runLoadEnv({ keys: ['NEVER_SET_TOKEN'] });
    expect(out.NEVER_SET_TOKEN).toBeNull();
  });

  test('per-key precedence is independent (different sources win per key)', () => {
    const out = runLoadEnv({
      processEnv: { A: 'p' },
      cwdEnv: { B: 'cwd' },
      trainsEnv: { B: 'trains', C: 'trains' },
      configEnv: { C: 'config', D: 'config' },
      keys: ['A', 'B', 'C', 'D'],
    });
    expect(out).toEqual({ A: 'p', B: 'cwd', C: 'trains', D: 'config' });
  });
});

describe('readDotenv — the line/quote parser', () => {
  function withFile(contents: string): Record<string, string> {
    const root = freshDir();
    const p = join(root, '.env');
    writeFileSync(p, contents);
    return readDotenv(p);
  }

  test('basic KEY=VALUE', () => {
    expect(withFile('FOO=bar\nBAZ=qux\n')).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  test('strips surrounding double and single quotes', () => {
    expect(withFile('A="hello world"\nB=\'single\'\n')).toEqual({ A: 'hello world', B: 'single' });
  });

  test('trims surrounding whitespace around key and value', () => {
    expect(withFile('  KEY  =  val  \n')).toEqual({ KEY: 'val' });
  });

  test('ignores lines that do not match KEY=VALUE (comments, blanks)', () => {
    expect(withFile('# a comment\n\nVALID=1\nnot a kv line\n')).toEqual({ VALID: '1' });
  });

  test('keys must start with letter/underscore (leading-digit key rejected)', () => {
    expect(withFile('1BAD=x\nGOOD=y\n')).toEqual({ GOOD: 'y' });
  });

  test('value with = inside is kept whole', () => {
    expect(withFile('URL=https://x/y?a=b&c=d\n')).toEqual({ URL: 'https://x/y?a=b&c=d' });
  });

  test('missing file returns empty object', () => {
    expect(readDotenv(join(freshDir(), 'does-not-exist.env'))).toEqual({});
  });
});
