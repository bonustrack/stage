import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isPrivateIp, SsrfError } from '../src/ssrf.ts';

test('rejects non-http(s) schemes', () => {
  assert.throws(() => assertPublicUrl('file:///etc/passwd'), SsrfError);
  assert.throws(() => assertPublicUrl('ftp://example.com'), SsrfError);
  assert.throws(() => assertPublicUrl('data:text/plain,hi'), SsrfError);
});

test('rejects blocked internal hosts', () => {
  assert.throws(() => assertPublicUrl('http://localhost/x'), SsrfError);
  assert.throws(() => assertPublicUrl('https://preview.metro.box/x'), SsrfError);
  assert.throws(() => assertPublicUrl('https://metro.box/x'), SsrfError);
  assert.throws(() => assertPublicUrl('http://metadata.google.internal/'), SsrfError);
});

test('rejects literal private IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.169.254', '0.0.0.0']) {
    assert.equal(isPrivateIp(ip), true, ip);
    assert.throws(() => assertPublicUrl(`http://${ip}/`), SsrfError, ip);
  }
});

test('rejects IPv4-mapped IPv6 - dotted-quad form', () => {
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
});

test('rejects IPv4-mapped IPv6 - packed hex form', () => {
  // ::ffff:7f00:1 == 127.0.0.1 ; ::ffff:a00:1 == 10.0.0.1
  assert.equal(isPrivateIp('::ffff:7f00:1'), true);
  assert.equal(isPrivateIp('::ffff:a00:1'), true);
  assert.equal(isPrivateIp('::ffff:c0a8:1'), true); // 192.168.0.1
  assert.throws(() => assertPublicUrl('http://[::ffff:7f00:1]/'), SsrfError);
});

test('rejects other private IPv6', () => {
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
  assert.equal(isPrivateIp('fd00::1'), true);
});

test('allows a normal public URL', () => {
  const u = assertPublicUrl('https://example.com/page?a=1');
  assert.equal(u.hostname, 'example.com');
  // a public IPv4-mapped address should NOT be flagged private
  assert.equal(isPrivateIp('::ffff:0808:0808'), false); // 8.8.8.8
});
