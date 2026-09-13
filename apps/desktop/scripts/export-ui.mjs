import { spawnSync } from 'node:child_process';
import { rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const stageDir = path.resolve(here, '..', '..', 'stage');
const outDir = path.resolve(here, '..', 'web');
const env = { ...process.env, APP_VARIANT: 'prod', EXPO_PUBLIC_ZERODEV_RP_ID: 'stage.box', EXPO_NO_TELEMETRY: '1' };

function run(command, args) {
  const result = spawnSync(command, args, { cwd: stageDir, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

rmSync(outDir, { recursive: true, force: true });
run('node', ['scripts/copy-xmtp-wasm.js']);
run('bunx', ['expo', 'export', '--platform', 'web', '--output-dir', outDir]);
