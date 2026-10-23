import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('Developer mode preferences are isolated from other suites\' module mocks', () => {
  const fixture = fileURLToPath(new URL('./developerMode.fixture.ts', import.meta.url));
  const result = spawnSync(process.execPath, ['test', fixture], {
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    encoding: 'utf8',
    timeout: 10000,
  });
  expect(result.error, result.stderr).toBeUndefined();
  expect(result.status, result.stdout + result.stderr).toBe(0);
}, 15000);
