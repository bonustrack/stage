/**
 * @file SSRF guard for the link-preview Worker: rejects non-http(s) schemes, private/loopback/link-local IP literals, and internal Metro/Stage hosts on every redirect hop.
 */

/** Hostnames we never fetch (internal Metro/Stage surface + cloud metadata). */
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

/** Whether I Pv4. */
function isIPv4(s: string): boolean {
  const p = s.split('.');
  return p.length === 4 && p.every(o => /^\d+$/.test(o) && Number(o) <= 255);
}

/** True if `ip` (v4 or v6 literal) is in a private / loopback / link-local / reserved range. A defence-in-depth check on top of the platform's refusal to route to private addresses. */
export function isPrivateIp(host: string): boolean {
  if (isIPv4(host)) return isPrivateV4(host);
  if (host.includes(':')) return isPrivateV6(host);
  return false;
}

/** Whether Private V4. */
function isPrivateV4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const a = parts[0] ?? NaN;
  const b = parts[1] ?? NaN;
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

/** Whether Private V6. */
function isPrivateV6(ip: string): boolean {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (x === '::1' || x === '::') return true; // loopback / unspecified
  if (x.startsWith('fe80')) return true; // link-local
  if (x.startsWith('fc') || x.startsWith('fd')) return true; // unique-local fc00::/7
  if (x.startsWith('ff')) return true; // multicast
  // IPv4-mapped IPv6, dotted-quad form: ::ffff:127.0.0.1
  const dotted = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  const dottedV4 = dotted?.[1];
  if (dottedV4 !== undefined) return isPrivateV4(dottedV4);
  // IPv4-mapped IPv6, packed hex form: ::ffff:7f00:1 == 127.0.0.1. Two 16-bit
  // hextets after ::ffff: encode the 4 IPv4 octets, so reassemble + reuse the v4
  // check. (Without this, ::ffff:7f00:1 would slip past as a "public" address.)
  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
  const hexHi = hex?.[1];
  const hexLo = hex?.[2];
  if (hexHi !== undefined && hexLo !== undefined) {
    const hi = parseInt(hexHi, 16);
    const lo = parseInt(hexLo, 16);
    const v4 = `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
    return isPrivateV4(v4);
  }
  return false;
}

/** Whether Blocked Host. */
function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  return BLOCKED_HOST_SUFFIXES.some(s => (s.startsWith('.') ? h.endsWith(s) : h === s));
}

export class SsrfError extends Error {}

/** Validate a URL is safe to fetch: scheme + host allowlist + literal-IP guard. Throws {@link SsrfError} on any violation; returns the parsed URL on success. (No DNS resolution - the runtime blocks private destinations itself.) */
export function assertPublicUrl(raw: string): URL {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new SsrfError('invalid url');
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') {
    throw new SsrfError('only http(s) urls are allowed');
  }
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (!host) throw new SsrfError('missing host');
  if (isBlockedHost(host)) throw new SsrfError('blocked host');
  if (isPrivateIp(host)) throw new SsrfError('private ip not allowed');
  return u;
}
