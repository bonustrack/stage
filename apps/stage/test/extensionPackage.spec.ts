import { describe, expect, test } from 'bun:test';
import { prepareExtensionHtml } from '../extension/package.mjs';

describe('Chrome extension HTML', () => {
  test('packages inline boot scripts without changing their order or attributes', () => {
    expect(prepareExtensionHtml('<script>boot()</script><script defer src="/entry.js"></script><script type="module">ready()</script>')).toEqual({
      html: '<script src="/inline-0.js"></script><script defer src="/entry.js"></script><script type="module" src="/inline-1.js"></script>',
      scripts: [{ name: 'inline-0.js', content: 'boot()' }, { name: 'inline-1.js', content: 'ready()' }],
    });
  });

  test('keeps the universal app document and packaged entry untouched', () => {
    const html = '<title>Stage</title><div id="root"></div><script src="/_expo/entry.js" defer></script>';
    expect(prepareExtensionHtml(html)).toEqual({ html, scripts: [] });
  });

  test.each(['https://cdn.example/app.js', '//cdn.example/app.js', 'data:text/javascript,boot()'])('rejects external executable sources: %s', (source) => {
    expect(() => prepareExtensionHtml(`<script src="${source}"></script>`)).toThrow('packaged scripts');
  });
});
