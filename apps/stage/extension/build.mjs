import { cp, mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportWeb } from '../scripts/exportWeb.mjs';
import { prepareExtensionAssetPaths, prepareExtensionHtml } from './package.mjs';

const shell = path.dirname(fileURLToPath(import.meta.url));
const output = path.resolve(process.argv[2] ?? path.join(shell, 'dist'));
const require = createRequire(import.meta.url);
const version = require('../app.config.js').expo.version;

await mkdir(output, { recursive: true });
if ((await readdir(output)).length) throw new Error('Choose an empty output directory.');
const temporary = await mkdtemp(path.join(tmpdir(), 'stage-extension-'));
async function prepareExtensionAssets(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await prepareExtensionAssets(file);
    } else if (/\.(html|js|css|json)$/.test(entry.name)) {
      const content = await readFile(file, 'utf8');
      const prepared = prepareExtensionAssetPaths(content);
      if (prepared !== content) await writeFile(file, prepared);
    }
  }
}

async function directoryBytes(directory) {
  const sizes = await Promise.all(
    (await readdir(directory, { withFileTypes: true })).map(async (entry) => {
      const file = path.join(directory, entry.name);
      return entry.isDirectory() ? directoryBytes(file) : (await stat(file)).size;
    }),
  );
  return sizes.reduce((total, size) => total + size, 0);
}

try {
  exportWeb(temporary, { STAGE_EXTENSION: '1', BROWSER: 'none' });
  const prepared = prepareExtensionHtml(await readFile(path.join(temporary, 'index.html'), 'utf8'));
  const manifest = JSON.parse(await readFile(path.join(shell, 'manifest.json'), 'utf8'));
  await writeFile(
    path.join(output, 'manifest.json'),
    `${JSON.stringify({ ...manifest, version, version_name: `${version} beta` }, null, 2)}\n`,
  );
  await writeFile(path.join(output, 'index.html'), prepared.html);
  for (const script of prepared.scripts) await writeFile(path.join(output, script.name), script.content);
  for (const resource of ['_expo', 'assets', 'wasm', 'favicon.ico', 'favicon.svg']) {
    await cp(path.join(temporary, resource), path.join(output, resource === '_expo' ? 'expo' : resource), { recursive: true });
  }
  await cp(path.join(shell, 'background.js'), path.join(output, 'background.js'));
  await cp(path.join(shell, 'icons'), path.join(output, 'icons'), { recursive: true });
  await prepareExtensionAssets(output);
  console.log(`Chrome extension: ${output} (${await directoryBytes(output)} bytes unpacked)`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}
