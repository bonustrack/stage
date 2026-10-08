import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const COMMANDS = [
  'run lint',
  'run typecheck',
  'run knip',
  'run madge',
  'run build',
  'test scripts/test',
  'test apps/stage/scripts/test/typographyLint.test.mjs',
  'run test',
];

function runChecks(failCommand = '') {
  const directory = mkdtempSync(join(tmpdir(), 'stage-source-checks-'));
  const calls = join(directory, 'calls');
  try {
    writeFileSync(join(directory, 'bun'), `#!/usr/bin/env bash
printf '%s|%s\\n' "$PWD" "$*" >> "$CALLS"
if [ "$*" = "$FAIL_COMMAND" ]; then exit 1; fi
`, { mode: 0o700 });
    const result = spawnSync('bash', [join(ROOT, 'scripts/check-source.sh')], {
      cwd: join(ROOT, 'apps/stage'),
      env: {
        ...process.env,
        PATH: `${directory}:${process.env.PATH}`,
        CALLS: calls,
        FAIL_COMMAND: failCommand,
        CONTEXT: 'deploy-preview',
        BRANCH: 'contributor-fork',
        GH_TOKEN: '',
      },
      encoding: 'utf8',
    });
    return { result, calls: readFileSync(calls, 'utf8').trim().split('\n') };
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe('shared source checks', () => {
  test('checks the exact checkout from the app directory, including fork previews without credentials', () => {
    const check = runChecks();
    expect(check.result.status).toBe(0);
    expect(check.calls).toEqual(COMMANDS.map((command) => `${ROOT}|${command}`));
  });

  test.each(COMMANDS)('stops immediately when %s fails', (command) => {
    const check = runChecks(command);
    expect(check.result.status).toBe(1);
    expect(check.calls).toEqual(COMMANDS.slice(0, COMMANDS.indexOf(command) + 1)
      .map((entry) => `${ROOT}|${entry}`));
  });
});
