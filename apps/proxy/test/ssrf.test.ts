import { expect, test } from 'bun:test';
import { assertPublicUrl, SsrfError } from '../src/ssrf.ts';

function refusal(url: string): string | null {
  try {
    assertPublicUrl(url);
    return null;
  } catch (e) {
    return e instanceof SsrfError ? e.message : 'not an SsrfError';
  }
}

test('rejects non-http(s) schemes', () => {
  expect(() => assertPublicUrl('file:///etc/passwd')).toThrow(SsrfError);
  expect(() => assertPublicUrl('ftp://example.com')).toThrow(SsrfError);
  expect(() => assertPublicUrl('data:text/plain,hi')).toThrow(SsrfError);
});

test('rejects blocked internal hosts', () => {
  expect(() => assertPublicUrl('http://localhost/x')).toThrow(SsrfError);
  expect(() => assertPublicUrl('https://preview.stage.box/x')).toThrow(SsrfError);
  expect(() => assertPublicUrl('https://stage.box/x')).toThrow(SsrfError);
  expect(() => assertPublicUrl('http://metadata.google.internal/')).toThrow(SsrfError);
  for (const url of ['https://proxy.stage.box../x', 'https://stage.box../', 'http://localhost../', 'https://db.internal.../']) {
    expect(() => assertPublicUrl(url), url).toThrow(SsrfError);
  }
});

test('rejects local names shared with the node policies', () => {
  for (const url of ['http://intranet/', 'http://nas.lan/', 'http://box.home.arpa/', 'http://localhost.localdomain/']) {
    expect([url, refusal(url)]).toEqual([url, 'blocked host']);
  }
});

test('rejects literal private IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.169.254', '0.0.0.0', '198.18.0.1', '2130706433']) {
    expect([ip, refusal(`http://${ip}/`)]).toEqual([ip, 'private ip not allowed']);
  }
});

test('rejects private IPv6 in every form', () => {
  for (const ip of ['::ffff:7f00:1', '::1', 'fe80::1', 'fe90::1', 'fd00::1', '64:ff9b::7f00:1', '2002:7f00:1::1', '::7f00:1']) {
    expect([ip, refusal(`http://[${ip}]/`)]).toEqual([ip, 'private ip not allowed']);
  }
});

test('allows a normal public URL', () => {
  const u = assertPublicUrl('https://example.com/page?a=1');
  expect(u.hostname).toBe('example.com');
  expect(assertPublicUrl('http://[::ffff:0808:0808]/').hostname).toBe('[::ffff:808:808]');
});
