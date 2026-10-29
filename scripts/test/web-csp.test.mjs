import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

const app = new URL('../../apps/stage/', import.meta.url);
const config = Bun.TOML.parse(readFileSync(new URL('netlify.toml', app), 'utf8'));
const site = config.headers.find((header) => header.for === '/*');
if (!site) throw new Error('Missing site-wide headers');
const policy = site.values['Content-Security-Policy'];
if (typeof policy !== 'string') throw new Error('Missing enforced CSP');
const directives = policy.split(';').map((part) => part.trim().split(/\s+/));
const sources = new Map(directives.map(([name, ...values]) => [name, values]));

function inlineScripts(name) {
  const html = readFileSync(new URL(name, app), 'utf8');
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)]
    .filter((match) => !/\bsrc\s*=/.test(match[1]))
    .map((match) => match[2]);
}

function hashSource(script) {
  return `'sha256-${createHash('sha256').update(script).digest('base64')}'`;
}

const inlineSources = ['public/index.html', 'public/preview-launcher.html'].flatMap(inlineScripts).map(hashSource);

describe('web Content Security Policy', () => {
  test('is enforced without reporting private URLs to a collector', () => {
    expect(site.values['Content-Security-Policy-Report-Only']).toBeUndefined();
    expect(sources.has('report-uri')).toBe(false);
    expect(sources.has('report-to')).toBe(false);
    expect(sources.size).toBe(directives.length);
    expect([...sources.keys()]).toEqual([
      'default-src',
      'script-src',
      'script-src-attr',
      'style-src',
      'img-src',
      'media-src',
      'font-src',
      'connect-src',
      'worker-src',
      'frame-src',
      'object-src',
      'base-uri',
      'form-action',
      'frame-ancestors',
    ]);
    expect(sources.get('default-src')).toEqual(["'none'"]);
  });

  test('allows only bundled scripts, XMTP WebAssembly and the exact inline scripts', () => {
    expect(inlineSources).toHaveLength(2);
    expect(sources.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", ...inlineSources]);
    expect(sources.get('script-src-attr')).toEqual(["'none'"]);
    expect(hashSource(`${inlineScripts('public/index.html')[0]} `)).not.toBe(inlineSources[0]);
  });

  test('keeps workers and fonts local while allowing rendered user resources', () => {
    expect(sources.get('worker-src')).toEqual(["'self'", 'blob:']);
    expect(sources.get('font-src')).toEqual(["'self'"]);
    expect(sources.get('style-src')).toEqual(["'self'", "'unsafe-inline'"]);
    expect(sources.get('img-src')).toEqual(["'self'", 'https:', 'data:', 'blob:']);
    expect(sources.get('media-src')).toEqual(["'self'", 'https:', 'data:', 'blob:']);
    expect(sources.get('connect-src')).toEqual(["'self'", 'https:', 'data:', 'blob:']);
  });

  test.each(['frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors'])('disallows %s', (directive) => {
    expect(sources.get(directive)).toEqual(["'none'"]);
  });

  test('preserves cross-origin isolation for the XMTP workers', () => {
    expect(site.values['Cross-Origin-Opener-Policy']).toBe('same-origin');
    expect(site.values['Cross-Origin-Embedder-Policy']).toBe('credentialless');
  });
});
