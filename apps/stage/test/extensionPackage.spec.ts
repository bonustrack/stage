import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { prepareExtensionAssets, prepareExtensionHtml } from '../extension/package.mjs';

describe('Chrome extension assets', () => {
  test('renames the reserved directory and rewrites entry, worker and lazy-chunk references', async () => {
    const directory = await mkdtemp(path.join(tmpdir(), 'stage-extension-assets-'));
    const manifest = JSON.stringify({ name: 'Stage', permissions: ['sidePanel'], version: '0.1.5' });
    const binary = new Uint8Array([0, 255, 95, 101, 120, 112, 111, 47]);
    const files = {
      'index.html': '<script src="/_expo/static/js/entry.js"></script>',
      'inline-0.js': 'globalThis.path = "/_expo/static/js/entry.js";',
      '_expo/static/js/entry.js': 'new Worker("/_expo/static/js/worker.js"); import("/_expo/static/js/lazy.js");',
      '_expo/static/js/worker.js': 'importScripts("/_expo/static/js/lazy.js");',
      '_expo/static/js/lazy.js': 'const __exportStar = "_expo_marker";',
      'assets/style.css': '@import url("/_expo/static/style.css");',
      '_expo/static/style.css': 'body { color: red; }',
      'assets/paths.json': JSON.stringify({ entry: '/_expo/static/js/entry.js' }),
    };
    try {
      for (const [name, content] of Object.entries(files)) {
        const file = path.join(directory, name);
        await mkdir(path.dirname(file), { recursive: true });
        await writeFile(file, content);
      }
      await writeFile(path.join(directory, 'manifest.json'), manifest);
      await writeFile(path.join(directory, 'assets/module.wasm'), binary);
      await prepareExtensionAssets(directory);
      expect(await readdir(directory)).not.toContain('_expo');
      expect(await readdir(directory)).toContain('expo');
      for (const [name, content] of Object.entries(files)) {
        const file = path.join(directory, name.replace(/^_expo\//, 'expo/'));
        expect(await readFile(file, 'utf8')).toBe(content.replaceAll('/_expo/', '/expo/'));
      }
      expect(await readFile(path.join(directory, 'manifest.json'), 'utf8')).toBe(manifest);
      expect(new Uint8Array(await readFile(path.join(directory, 'assets/module.wasm')))).toEqual(binary);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});

describe('Chrome extension HTML', () => {
  test('packages inline boot scripts without changing their order or attributes', () => {
    expect(prepareExtensionHtml('<script>boot()</script><script defer src="/entry.js"></script><script type="module">ready()</script>')).toEqual({
      html: '<script src="/inline-0.js"></script><script defer src="/entry.js"></script><script type="module" src="/inline-1.js"></script>',
      scripts: [{ name: 'inline-0.js', content: 'boot()' }, { name: 'inline-1.js', content: 'ready()' }],
    });
  });

  test('leaves asset paths for the packaging pass', () => {
    const html = '<title>Stage</title><div id="root"></div><script src="/_expo/entry.js" defer></script>';
    expect(prepareExtensionHtml(html)).toEqual({ html, scripts: [] });
  });

  test.each(['https://cdn.example/app.js', '//cdn.example/app.js', 'data:text/javascript,boot()'])('rejects external executable sources: %s', (source) => {
    expect(() => prepareExtensionHtml(`<script src="${source}"></script>`)).toThrow('packaged scripts');
  });
});
