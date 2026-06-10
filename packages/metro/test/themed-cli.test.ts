/**
 * Themed porcelain CLI surface (migration step 5): the channel/group/dm verbs,
 * the uniform {ok,command,result|error,code} envelope, --quiet, deterministic
 * exit codes, and the `board` alias. CLI-level tests run the compiled binary in
 * a sandboxed METRO_STATE_DIR with no daemon (so forward-call surfaces code 4);
 * unit tests exercise the runVerb envelope + EXIT codes directly.
 */

import { describe, expect, test, beforeEach, afterAll } from 'bun:test';
import { env, freshStateDir, cleanupAll, runCli } from './broker-helpers.ts';
import { EXIT, runVerb } from '../src/cli/verbs.ts';

beforeEach(() => { env.STATE_DIR = freshStateDir(); });
afterAll(cleanupAll);

const DM_ADDR = '0x2539000000000000000000000000000000000000';
const LINE = 'metro://xmtp/tony/abc123';

describe('themed verbs: registration + usage', () => {
  test('--help lists the new verbs and the board alias', () => {
    const r = runCli(['--help']);
    expect(r.status).toBe(0);
    for (const tok of ['metro channel', 'metro group', 'metro dm', 'metro board']) {
      expect(r.stdout).toContain(tok);
    }
    expect(r.stdout).toContain('7 rate-limited');
  });

  test('channel with bad subcommand → usage error (code 1)', () => {
    const r = runCli(['channel', 'bogus', LINE]);
    expect(r.status).toBe(EXIT.usage);
  });

  test('group with no subcommand → usage error (code 1)', () => {
    const r = runCli(['group']);
    expect(r.status).toBe(EXIT.usage);
  });

  test('dm with no address → usage error (code 1)', () => {
    const r = runCli(['dm']);
    expect(r.status).toBe(EXIT.usage);
  });

  test('group new with no addresses → usage error (code 1)', () => {
    const r = runCli(['group', 'new', '--name', 'x']);
    expect(r.status).toBe(EXIT.usage);
  });
});

describe('themed verbs: uniform error envelope (no daemon → code 4)', () => {
  test('dm --json emits {ok:false, command:"dm", code:4}', () => {
    const r = runCli(['dm', DM_ADDR, '--json']);
    expect(r.status).toBe(EXIT.daemonDown);
    const env_ = JSON.parse(r.stdout.trim());
    expect(env_.ok).toBe(false);
    expect(env_.command).toBe('dm');
    expect(env_.code).toBe(EXIT.daemonDown);
    expect(typeof env_.error).toBe('string');
  });

  test('channel set-github --json carries its command tag', () => {
    const r = runCli(['channel', 'set-github', LINE, 'https://github.com/x/y', '--json']);
    expect(r.status).toBe(EXIT.daemonDown);
    const env_ = JSON.parse(r.stdout.trim());
    expect(env_.ok).toBe(false);
    expect(env_.command).toBe('channel.set-github');
  });

  test('group close --json carries its command tag', () => {
    const r = runCli(['group', 'close', LINE, '--json']);
    const env_ = JSON.parse(r.stdout.trim());
    expect(env_.command).toBe('group.close');
    expect(env_.code).toBe(EXIT.daemonDown);
  });

  test('human error path (no --json) writes to stderr, exits 4', () => {
    const r = runCli(['dm', DM_ADDR]);
    expect(r.status).toBe(EXIT.daemonDown);
    expect(r.stderr).toContain('error:');
    expect(r.stdout).toBe('');
  });
});

describe('legacy behavior preserved (additive)', () => {
  test('legacy `call` error envelope stays {ok:false,error,code} with no command key', () => {
    const r = runCli(['call', 'xmtp', 'send', '{"line":"metro://xmtp/x/y","text":"hi"}', '--json']);
    expect(r.status).toBe(EXIT.daemonDown);
    const env_ = JSON.parse(r.stdout.trim());
    expect(env_.ok).toBe(false);
    expect('command' in env_).toBe(false);
  });

  test('board is an alias of tail (claim-aware feed, exits 0 on empty)', () => {
    const r = runCli(['board', '--all', '--json']);
    expect(r.status).toBe(0);
  });
});

describe('runVerb envelope (unit)', () => {
  function capture(fn: () => Promise<void>): Promise<string> {
    const chunks: string[] = [];
    const orig = process.stdout.write.bind(process.stdout);
    (process.stdout as { write: unknown }).write = (s: string) => { chunks.push(s); return true; };
    return fn().finally(() => { (process.stdout as { write: unknown }).write = orig; })
      .then(() => chunks.join(''));
  }

  test('--json success → {ok:true, command, result}', async () => {
    const out = await capture(() => runVerb('dm', { json: true },
      async () => ({ line: LINE, id: 'abc123' }), () => 'human'));
    const env_ = JSON.parse(out.trim());
    expect(env_).toEqual({ ok: true, command: 'dm', result: { line: LINE, id: 'abc123' } });
  });

  test('--quiet → result id only', async () => {
    const out = await capture(() => runVerb('dm', { quiet: true },
      async () => ({ line: LINE, id: 'abc123' }), () => 'human'));
    expect(out.trim()).toBe('abc123');
  });

  test('default → the human line', async () => {
    const out = await capture(() => runVerb('dm', {},
      async () => ({ line: LINE }), () => `dm ${LINE}`));
    expect(out.trim()).toBe(`dm ${LINE}`);
  });

  test('failure rethrows ExitErr carrying command + resolved code', async () => {
    let caught: { code?: number; command?: string } | undefined;
    try {
      await runVerb('group.close', { json: false },
        async () => { throw Object.assign(new Error('rate limit hit'), {}); },
        () => 'x');
    } catch (e) { caught = e as { code?: number; command?: string }; }
    expect(caught?.command).toBe('group.close');
    expect(caught?.code).toBe(EXIT.rateLimited);
  });
});
