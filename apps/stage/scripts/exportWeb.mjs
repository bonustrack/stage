import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const STAGE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const EXPORT_ENV = {
  APP_VARIANT: 'prod',
  EXPO_NO_TELEMETRY: '1',
  EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: '1',
  EXPO_UNSTABLE_TREE_SHAKING: '1',
};

function run(command, args, env) {
  const result = spawnSync(command, args, { cwd: STAGE_DIR, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}

export function exportWeb(outputDir, extraEnv = {}) {
  const env = { ...process.env, ...EXPORT_ENV, ...extraEnv };
  run('node', ['scripts/copy-xmtp-wasm.js'], env);
  run('bunx', ['--no-install', 'expo', 'export', '--platform', 'web', '--output-dir', outputDir], env);
}
