import { spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { prepareExtensionAssets, prepareExtensionHtml } from '../apps/stage/extension/package.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const stage = path.join(root, 'apps/stage');
const shell = path.join(stage, 'extension');
const output = path.resolve(process.argv[2] ?? path.join(shell, 'dist'));
const require = createRequire(import.meta.url);
const version = require('../apps/stage/app.config.js').expo.version;

await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('Choose an empty output directory.');
const temporary = await mkdtemp(path.join(tmpdir(), 'stage-extension-'));
const env = {
  ...process.env,
  APP_VARIANT: 'prod',
  STAGE_EXTENSION: '1',
  BROWSER: 'none',
  EXPO_NO_TELEMETRY: '1',
  EXPO_UNSTABLE_METRO_OPTIMIZE_GRAPH: '1',
  EXPO_UNSTABLE_TREE_SHAKING: '1',
};

function run(command, args) {
  const result = spawnSync(command, args, { cwd: stage, env, stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status}).`);
}

async function directoryBytes(directory) {
  const sizes = await Promise.all((await readdir(directory, { withFileTypes: true })).map(async entry => {
    const file = path.join(directory, entry.name);
    return entry.isDirectory() ? directoryBytes(file) : (await stat(file)).size;
  }));
  return sizes.reduce((total, size) => total + size, 0);
}

try {
  run('node', ['scripts/copy-xmtp-wasm.js']);
  run('bunx', ['--no-install', 'expo', 'export', '--platform', 'web', '--output-dir', temporary]);
  const prepared = prepareExtensionHtml(await readFile(path.join(temporary, 'index.html'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(shell, 'manifest.json'), 'utf8'));
  await writeFile(path.join(output, 'manifest.json'), `${JSON.stringify({ ...manifest, version, version_name: `${version} beta` }, null, 2)}\n`);
  await writeFile(path.join(output, 'index.html'), prepared.html);
  for (const script of prepared.scripts) await writeFile(path.join(output, script.name), script.content);
  for (const resource of ['_expo', 'assets', 'wasm', 'favicon.ico', 'favicon.svg']) {
    await cp(path.join(temporary, resource), path.join(output, resource), { recursive: true });
  }
  await cp(path.join(shell, 'background.js'), path.join(output, 'background.js'));
  await cp(path.join(stage, 'assets/icon.png'), path.join(output, 'icon.png'));
  await prepareExtensionAssets(output);
  console.log(`Chrome extension: ${output} (${await directoryBytes(output)} bytes unpacked)`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
