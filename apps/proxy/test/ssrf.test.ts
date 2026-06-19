import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPublicUrl, isPrivateIp, SsrfError } from '../src/ssrf.ts';

void test('rejects non-http(s) schemes', () => {
  assert.throws(() => assertPublicUrl('file:///etc/passwd'), SsrfError);
  assert.throws(() => assertPublicUrl('ftp://example.com'), SsrfError);
  assert.throws(() => assertPublicUrl('data:text/plain,hi'), SsrfError);
});

void test('rejects blocked internal hosts', () => {
  assert.throws(() => assertPublicUrl('http://localhost/x'), SsrfError);
  assert.throws(() => assertPublicUrl('https://preview.metro.box/x'), SsrfError);
  assert.throws(() => assertPublicUrl('https://metro.box/x'), SsrfError);
  assert.throws(() => assertPublicUrl('http://metadata.google.internal/'), SsrfError);
});

void test('rejects literal private IPv4', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '169.254.169.254', '0.0.0.0']) {
    assert.equal(isPrivateIp(ip), true, ip);
    assert.throws(() => assertPublicUrl(`http://${ip}/`), SsrfError, ip);
  }
});

void test('rejects IPv4-mapped IPv6 - dotted-quad form', () => {
  assert.equal(isPrivateIp('::ffff:127.0.0.1'), true);
});

void test('rejects IPv4-mapped IPv6 - packed hex form', () => {
  // ::ffff:7f00:1 == 127.0.0.1 ; ::ffff:a00:1 == 10.0.0.1
  assert.equal(isPrivateIp('::ffff:7f00:1'), true);
  assert.equal(isPrivateIp('::ffff:a00:1'), true);
  assert.equal(isPrivateIp('::ffff:c0a8:1'), true); // 192.168.0.1
  assert.throws(() => assertPublicUrl('http://[::ffff:7f00:1]/'), SsrfError);
});

void test('rejects other private IPv6', () => {
  assert.equal(isPrivateIp('::1'), true);
  assert.equal(isPrivateIp('fe80::1'), true);
  assert.equal(isPrivateIp('fd00::1'), true);
});

void test('rejects non-dotted-quad numeric IPv4 encodings (SSRF bypass)', () => {
  // All of these resolve to 127.0.0.1 / private ranges but slip past a
  // dotted-quad-only guard. new URL() accepts each as a host.
  const bypasses = [
    'http://2130706433/', // decimal 127.0.0.1
    'http://0x7f000001/', // hex 127.0.0.1
    'http://0177.0.0.1/', // octal-leading 127.0.0.1
    'http://127.1/', // short form 127.0.0.1
    'http://0/', // 0.0.0.0
    'http://0xa9fea9fe/', // hex 169.254.169.254 (cloud metadata)
    'http://2852039166/', // decimal 169.254.169.254
    'http://0xc0.0xa8.0x00.0x01/', // hex-per-octet 192.168.0.1
    'http://017700000001/', // single octal 127.0.0.1
  ];
  for (const u of bypasses) {
    assert.throws(() => assertPublicUrl(u), SsrfError, u);
  }
});

void test('isPrivateIp flags numeric IPv4 literals', () => {
  assert.equal(isPrivateIp('2130706433'), true); // 127.0.0.1
  assert.equal(isPrivateIp('0x7f000001'), true);
  assert.equal(isPrivateIp('127.1'), true);
  assert.equal(isPrivateIp('0xa9fea9fe'), true); // 169.254.169.254
  // Real hostnames must NOT be misclassified as numeric IPs.
  assert.equal(isPrivateIp('example.com'), false);
  assert.equal(isPrivateIp('a.b.c.d'), false);
});

void test('allows a normal public URL', () => {
  const u = assertPublicUrl('https://example.com/page?a=1');
  assert.equal(u.hostname, 'example.com');
  // a public IPv4-mapped address should NOT be flagged private
  assert.equal(isPrivateIp('::ffff:0808:0808'), false); // 8.8.8.8
});
