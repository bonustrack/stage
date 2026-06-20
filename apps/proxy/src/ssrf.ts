/** @file SSRF guard for the link-preview Worker: rejects non-http(s) schemes, private/loopback/link-local IP literals, and internal Metro/Stage hosts on every redirect hop. */

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

/** Private/loopback/reserved IPv4 ranges keyed on the first octet `a`, each rule optionally constraining the second octet `b`; replaces a long if-chain. */
const PRIVATE_V4_RULES: { a: number; b?: (b: number) => boolean }[] = [
  { a: 10 }, /** 10.0.0.0/8 */
  { a: 127 }, /** loopback */
  { a: 0 }, /** 0.0.0.0/8 "this host" */
  { a: 169, b: b => b === 254 }, /** link-local 169.254/16 (cloud metadata) */
  { a: 172, b: b => b >= 16 && b <= 31 }, /** 172.16/12 */
  { a: 192, b: b => b === 168 }, /** 192.168/16 */
  { a: 100, b: b => b >= 64 && b <= 127 }, /** CGNAT 100.64/10 */
];

/** Whether Private V4. */
function isPrivateV4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const a = parts[0] ?? NaN;
  const b = parts[1] ?? NaN;
  if (a >= 224) return true; /** multicast + reserved */
  return PRIVATE_V4_RULES.some(r => r.a === a && (r.b ? r.b(b) : true));
}

/** IPv6 prefixes that are always private/loopback/link-local/multicast. */
const PRIVATE_V6_EXACT = new Set(['::1', '::']); /** loopback / unspecified */
const PRIVATE_V6_PREFIXES = ['fe80', 'fc', 'fd', 'ff']; /** link-local, ULA, multicast */

/** Extract the embedded IPv4 from an IPv4-mapped IPv6 literal, or undefined. */
function mappedV4(x: string): string | undefined {
  /** dotted-quad form: ::ffff:127.0.0.1 */
  const dotted = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (dotted?.[1] !== undefined) return dotted[1];
  /** packed hex form (::ffff:7f00:1 == 127.0.0.1): the two 16-bit hextets after ::ffff: encode the 4 IPv4 octets, so reassemble them. */
  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
  const hexHi = hex?.[1];
  const hexLo = hex?.[2];
  if (hexHi === undefined || hexLo === undefined) return undefined;
  const hi = parseInt(hexHi, 16);
  const lo = parseInt(hexLo, 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

/** Whether Private V6. */
function isPrivateV6(ip: string): boolean {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (PRIVATE_V6_EXACT.has(x)) return true;
  if (PRIVATE_V6_PREFIXES.some(p => x.startsWith(p))) return true;
  const v4 = mappedV4(x);
  return v4 !== undefined ? isPrivateV4(v4) : false;
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
