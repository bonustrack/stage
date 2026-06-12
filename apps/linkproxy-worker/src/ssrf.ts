/** SSRF guard for the link-preview Worker.
 *
 *  Unlike the Node service this Worker does NOT (and cannot) resolve DNS: the
 *  Cloudflare Workers runtime refuses to connect to private / loopback /
 *  link-local / RFC1918 addresses from `fetch()` by design, so DNS-rebinding to
 *  an internal IP is already neutralised at the platform layer. We therefore
 *  keep only the host-allowlist guard here: reject non-http(s) schemes, literal
 *  private IPs (cheap, catches obvious probes), and our own internal Metro/Stage
 *  surface (which is reachable from inside Cloudflare's network and so must be
 *  blocked explicitly). The literal-IP and host checks are re-run on every
 *  redirect hop by the caller. */

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

function isIPv4(s: string): boolean {
  const p = s.split('.');
  return p.length === 4 && p.every(o => /^\d+$/.test(o) && Number(o) <= 255);
}

/** True if `ip` (v4 or v6 literal) is in a private / loopback / link-local /
 *  reserved range. A defence-in-depth check on top of the platform's refusal to
 *  route to private addresses. */
export function isPrivateIp(host: string): boolean {
  if (isIPv4(host)) return isPrivateV4(host);
  if (host.includes(':')) return isPrivateV6(host);
  return false;
}

function isPrivateV4(ip: string): boolean {
  const [a, b] = ip.split('.').map(Number);
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
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (x === '::1' || x === '::') return true; // loopback / unspecified
  if (x.startsWith('fe80')) return true; // link-local
  if (x.startsWith('fc') || x.startsWith('fd')) return true; // unique-local fc00::/7
  if (x.startsWith('ff')) return true; // multicast
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

/** Validate a URL is safe to fetch: scheme + host allowlist + literal-IP guard.
 *  Throws {@link SsrfError} on any violation; returns the parsed URL on success.
 *  (No DNS resolution - the runtime blocks private destinations itself.) */
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
