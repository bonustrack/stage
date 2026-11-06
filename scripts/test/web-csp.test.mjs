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
  test('allows only bundled scripts, XMTP WebAssembly and the exact inline scripts', () => {
    expect(sources.get('script-src')).toEqual(["'self'", "'wasm-unsafe-eval'", ...inlineSources]);
    expect(sources.get('script-src-attr')).toEqual(["'none'"]);
  });

  test('is enforced, reports nowhere and locks down everything it does not need', () => {
    expect(site.values['Content-Security-Policy-Report-Only']).toBeUndefined();
    expect(sources.size).toBe(directives.length);
    expect(sources.has('report-uri') || sources.has('report-to')).toBe(false);
    for (const directive of ['default-src', 'frame-src', 'object-src', 'base-uri', 'form-action', 'frame-ancestors']) {
      expect([directive, sources.get(directive)]).toEqual([directive, ["'none'"]]);
    }
    const loose = [...sources].filter(([, values]) => values.some((value) => ['*', 'http:', "'unsafe-eval'"].includes(value)));
    expect(loose).toEqual([]);
  });
});
