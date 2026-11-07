import { describe, expect, test } from 'bun:test';
import { hostProblem, isPublicHost } from '../src/net/publicHost';

const isPrivateIp = (host: string): boolean => hostProblem(host) === 'private-ip';
import { declaredLength, readCappedBytes, readCappedResponse } from '../src/net/cappedBody';
import { clientIp } from '../src/net/clientIp';

describe('private addresses', () => {
  test('private, loopback, link-local, carrier, benchmark and multicast IPv4', () => {
    const blocked = [
      '0.0.0.0',
      '10.1.2.3',
      '127.0.0.1',
      '169.254.169.254',
      '172.16.0.1',
      '172.31.255.255',
      '192.168.0.1',
      '100.64.0.1',
      '100.127.255.255',
      '198.18.0.1',
      '198.19.255.255',
      '224.0.0.1',
      '255.255.255.255',
    ];
    for (const ip of blocked) expect([ip, isPrivateIp(ip)]).toEqual([ip, true]);
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.32.0.1', '100.128.0.1', '198.20.0.1', '169.253.0.1']) {
      expect([ip, isPrivateIp(ip)]).toEqual([ip, false]);
    }
  });

  test('loopback, unique local, link-local, multicast, NAT64, 6to4 and translated IPv6', () => {
    const blocked = [
      '::',
      '::1',
      '[::1]',
      'fc00::1',
      'fd00::1',
      'fe80::1',
      'fe90::1',
      'fec0::1',
      'ff02::1',
      '64:ff9b::7f00:1',
      '64:ff9b:1::1',
      '2002:7f00:1::1',
      '::ffff:0:a00:1',
    ];
    for (const ip of blocked) expect([ip, isPrivateIp(ip)]).toEqual([ip, true]);
  });

  test('IPv4 inside IPv6 counts by its IPv4 address', () => {
    for (const ip of [
      '::ffff:127.0.0.1',
      '::ffff:7f00:1',
      '::ffff:a00:1',
      '::ffff:c0a8:1',
      '::7f00:1',
      '::127.0.0.1',
      '2001:db8::ffff:7f00:1',
    ]) {
      expect([ip, isPrivateIp(ip)]).toEqual([ip, true]);
    }
    for (const ip of ['::ffff:808:808', '::ffff:0808:0808', '::ffff:8.8.8.8', '2606:4700:4700::1111']) {
      expect([ip, isPrivateIp(ip)]).toEqual([ip, false]);
    }
  });
});

describe('public host names', () => {
  test('local names, single labels and numeric last labels are not public', () => {
    for (const host of [
      'localhost',
      'api.localhost',
      'printer.local',
      'localhost.localdomain',
      'db.internal',
      'metadata.google.internal',
      'nas.lan',
      'box.home.arpa',
      'intranet',
      'example.123',
      'example.0x1f',
      'localhost..',
      'printer.local...',
    ]) {
      expect([host, hostProblem(host)]).toEqual([host, 'local']);
    }
  });

  test('public names and addresses pass, private addresses are named as such', () => {
    for (const host of ['example.com', 'a.b.example.org', 'xn--bcher-kva.example', 'EXAMPLE.COM.', '1.1.1.1', '[2606:4700::1111]']) {
      expect([host, isPublicHost(host)]).toEqual([host, true]);
    }
    expect(hostProblem('10.0.0.1')).toBe('private-ip');
    expect(hostProblem('[fd00::1]')).toBe('private-ip');
  });

  test('a caller can refuse every IP literal', () => {
    for (const host of ['1.1.1.1', '8.8.8.8', '[2606:4700::1111]', '2606:4700::1111']) {
      expect([host, hostProblem(host, { ipLiterals: false })]).toEqual([host, 'ip-literal']);
    }
    expect(isPublicHost('example.com', { ipLiterals: false })).toBe(true);
  });

  test('a caller can block a domain with its subdomains', () => {
    const policy = { blockedDomains: ['stage.box'] };
    for (const host of ['stage.box', 'proxy.stage.box', 'STAGE.BOX.', 'a.b.stage.box..']) {
      expect([host, hostProblem(host, policy)]).toEqual([host, 'local']);
    }
    expect(isPublicHost('notstage.box', policy)).toBe(true);
    expect(isPublicHost('stage.box.example.com', policy)).toBe(true);
    expect(isPublicHost('stage.box')).toBe(true);
  });
});

function streamOf(...chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });
}

describe('capped body reads', () => {
  test('a missing body reads as empty', async () => {
    expect(await readCappedBytes(null, 4, 'reject')).toEqual(new Uint8Array());
  });

  test('reject mode returns the whole body up to the cap and nothing past it', async () => {
    expect(new TextDecoder().decode((await readCappedBytes(streamOf('ab', 'cd'), 4, 'reject')) ?? undefined)).toBe('abcd');
    expect(await readCappedBytes(streamOf('ab', 'cde'), 4, 'reject')).toBeNull();
  });

  test('truncate mode stops reading once the cap is reached', async () => {
    const bytes = await readCappedBytes(streamOf('ab', 'cd', 'ef'), 3, 'truncate');
    expect(new TextDecoder().decode(bytes ?? undefined)).toBe('abcd');
  });

  test('a declared length counts only when it is a whole number of bytes', () => {
    expect(declaredLength(new Headers({ 'content-length': '12' }))).toBe(12);
    expect(declaredLength(new Headers({ 'content-length': '0' }))).toBe(0);
    for (const raw of ['abc', '-1', '1.5']) expect([raw, declaredLength(new Headers({ 'content-length': raw }))]).toEqual([raw, null]);
    expect(declaredLength(new Headers())).toBeNull();
  });

  test('a response is refused on its declared length, and on its real length when it declares none', async () => {
    expect(await readCappedResponse(new Response(streamOf('ab'), { headers: { 'content-length': '5' } }), 4)).toBeNull();
    expect(await readCappedResponse(new Response(streamOf('ab', 'cde')), 4)).toBeNull();
    expect(new TextDecoder().decode((await readCappedResponse(new Response(streamOf('ab', 'cd')), 4)) ?? undefined)).toBe('abcd');
  });
});

describe('client IP', () => {
  test('is the Cloudflare connecting IP and never a forwarded header', () => {
    expect(clientIp(new Headers({ 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.1' }))).toBe('203.0.113.7');
    expect(clientIp(new Headers({ 'x-forwarded-for': '198.51.100.1' }))).toBe('unknown');
  });
});
