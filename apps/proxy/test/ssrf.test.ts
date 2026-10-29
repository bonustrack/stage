import { expect, test } from 'bun:test';
import { assertPublicUrl, isPrivateIp, SsrfError } from '../src/ssrf.ts';

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

test('rejects literal private IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.169.254', '0.0.0.0']) {
    expect(isPrivateIp(ip), ip).toBe(true);
    expect(() => assertPublicUrl(`http://${ip}/`), ip).toThrow(SsrfError);
  }
});

test('rejects IPv4-mapped IPv6 - dotted-quad form', () => {
  expect(isPrivateIp('::ffff:127.0.0.1')).toBe(true);
});

test('rejects IPv4-mapped IPv6 - packed hex form', () => {
  expect(isPrivateIp('::ffff:7f00:1')).toBe(true);
  expect(isPrivateIp('::ffff:a00:1')).toBe(true);
  expect(isPrivateIp('::ffff:c0a8:1')).toBe(true);
  expect(() => assertPublicUrl('http://[::ffff:7f00:1]/')).toThrow(SsrfError);
});

test('rejects other private IPv6', () => {
  expect(isPrivateIp('::1')).toBe(true);
  expect(isPrivateIp('fe80::1')).toBe(true);
  expect(isPrivateIp('fd00::1')).toBe(true);
});

test('allows a normal public URL', () => {
  const u = assertPublicUrl('https://example.com/page?a=1');
  expect(u.hostname).toBe('example.com');
  expect(isPrivateIp('::ffff:0808:0808')).toBe(false);
});
