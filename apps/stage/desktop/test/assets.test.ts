import { describe, expect, test } from 'bun:test';
import path from 'node:path';
import { ISOLATION_HEADERS, mimeFor, webFilePath } from '../src/assets';

const root = path.resolve('/bundle/web');

describe('webFilePath', () => {
  test('maps the root and plain paths onto files inside the bundle', () => {
    expect(webFilePath(root, '/')).toBe(path.join(root, 'index.html'));
    expect(webFilePath(root, '/_expo/static/js/web/entry-abc.js')).toBe(path.join(root, '_expo/static/js/web/entry-abc.js'));
    expect(webFilePath(root, '/bindings%5Fwasm_bg.wasm')).toBe(path.join(root, 'bindings_wasm_bg.wasm'));
  });

  test('rejects traversal and malformed paths', () => {
    expect(webFilePath(root, '/../secrets')).toBeNull();
    expect(webFilePath(root, '/a//b')).toBeNull();
    expect(webFilePath(root, '/%zz')).toBeNull();
  });
});

describe('mimeFor', () => {
  test('knows the export file types and falls back to octet-stream', () => {
    expect(mimeFor('index.html')).toBe('text/html; charset=utf-8');
    expect(mimeFor('a.wasm')).toBe('application/wasm');
    expect(mimeFor('a.woff2')).toBe('font/woff2');
    expect(mimeFor('a.unknown')).toBe('application/octet-stream');
  });
});

describe('ISOLATION_HEADERS', () => {
  test('matches the headers the web deploy sends', () => {
    expect(ISOLATION_HEADERS['cross-origin-opener-policy']).toBe('same-origin');
    expect(ISOLATION_HEADERS['cross-origin-embedder-policy']).toBe('credentialless');
  });
});
