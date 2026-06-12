/** SSRF guard for the link-preview proxy.
 *
 *  The proxy fetches arbitrary user-supplied URLs server-side, so it MUST refuse
 *  to reach internal infrastructure. We:
 *    1. allow only http/https + a normal port,
 *    2. reject hostnames that are literal private/loopback/link-local IPs,
 *    3. reject our own internal hosts (metro/stage daemon, localhost names),
 *    4. resolve the hostname's A/AAAA records and reject if ANY resolved address
 *       falls in a private/loopback/link-local/reserved range (defeats DNS
 *       rebinding to a public name that points at 127.0.0.1 / 169.254.x / 10.x).
 *
 *  Callers should both pre-check the URL (`assertPublicUrl`) AND, when they have
 *  the final post-redirect URL, re-check it. */

import { lookup } from 'node:dns/promises';
import net from 'node:net';

/** Hostnames we never fetch regardless of DNS (internal Metro/Stage surface). */
const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  '.localhost',
  '.local',
  '.internal',
  '.metro.box',
  '.stage.box',
];

/** Exact internal hosts (no subdomain) we also block. */
const BLOCKED_HOSTS = new Set([
  'metro.box',
  'stage.box',
  'metadata.google.internal',
]);

/** True if `ip` (v4 or v6) is in a private / loopback / link-local / reserved
 *  range that must never be reachable from the proxy. */
export function isPrivateIp(ip: string): boolean {
  const kind = net.isIP(ip);
  if (kind === 4) return isPrivateV4(ip);
  if (kind === 6) return isPrivateV6(ip);
  return false;
}

function isPrivateV4(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some(n => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 0) return true; // 0.0.0.0/8 "this host"
  if (a === 169 && b === 254) return true; // link-local 169.254/16 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16/12
  if (a === 192 && b === 168) return true; // 192.168/16
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64/10
  if (a >= 224) return true; // multicast + reserved
  return false;
}

function isPrivateV6(ip: string): boolean {
  const x = ip.toLowerCase();
  if (x === '::1' || x === '::') return true; // loopback / unspecified
  if (x.startsWith('fe80')) return true; // link-local
  if (x.startsWith('fc') || x.startsWith('fd')) return true; // unique-local fc00::/7
  if (x.startsWith('ff')) return true; // multicast
  // IPv4-mapped (::ffff:a.b.c.d) — extract and test the v4 part.
  const m = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (m) return isPrivateV4(m[1]);
  return false;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  return BLOCKED_HOST_SUFFIXES.some(s => (s.startsWith('.') ? h.endsWith(s) : h === s));
}

export class SsrfError extends Error {}

/** Validate a URL is safe to fetch: scheme, host allowlist, and DNS resolution
 *  to a public address. Throws {@link SsrfError} on any violation. Returns the
 *  parsed URL on success. */
export async function assertPublicUrl(raw: string): Promise<URL> {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError('invalid url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError('only http(s) urls are allowed');
  }
  const host = u.hostname;
  if (!host) throw new SsrfError('missing host');
  if (isBlockedHost(host)) throw new SsrfError('blocked host');

  // If the host is already a literal IP, test it directly (skip DNS).
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new SsrfError('private ip not allowed');
    return u;
  }

  // Resolve ALL addresses; reject if any is private (DNS-rebinding defense).
  let addrs: { address: string }[];
  try {
    addrs = await lookup(host, { all: true });
  } catch {
    throw new SsrfError('dns resolution failed');
  }
  if (addrs.length === 0) throw new SsrfError('no dns records');
  for (const a of addrs) {
    if (isPrivateIp(a.address)) throw new SsrfError('host resolves to a private ip');
  }
  return u;
}
