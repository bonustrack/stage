import { describe, expect, test } from 'bun:test';
import { prepareExtensionAssetPaths, prepareExtensionHtml } from '../extension/package.mjs';

describe('Chrome extension asset paths', () => {
  test.each([
    ['<script src="/_expo/static/js/entry.js"></script>', '<script src="/expo/static/js/entry.js"></script>'],
    ['new Worker("/_expo/static/js/worker.js"); import("/_expo/static/js/lazy.js");', 'new Worker("/expo/static/js/worker.js"); import("/expo/static/js/lazy.js");'],
    ['importScripts("/_expo/static/js/lazy.js");', 'importScripts("/expo/static/js/lazy.js");'],
    ['{"paths":{"42":"/_expo/static/js/lazy.js"}}', '{"paths":{"42":"/expo/static/js/lazy.js"}}'],
    ['@import url("/_expo/static/style.css");', '@import url("/expo/static/style.css");'],
    ['const __exportStar = "_expo_marker";', 'const __exportStar = "_expo_marker";'],
    ['{"permissions":["sidePanel"],"version":"0.1.5"}', '{"permissions":["sidePanel"],"version":"0.1.5"}'],
  ])('normalizes only packaged Expo path segments: %s', (input, expected) => {
    expect(prepareExtensionAssetPaths(input)).toBe(expected);
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
