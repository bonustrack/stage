
const BLOCKED_HOST_SUFFIXES = [
  'localhost',
  '.localhost',
  '.local',
  '.internal',
  '.metro.box',
  '.stage.box',
];

const BLOCKED_HOSTS = new Set([
  'metro.box',
  'stage.box',
  'metadata.google.internal',
]);

function isIPv4(s: string): boolean {
  const p = s.split('.');
  return p.length === 4 && p.every(o => /^\d+$/.test(o) && Number(o) <= 255);
}

export function isPrivateIp(host: string): boolean {
  if (isIPv4(host)) return isPrivateV4(host);
  if (host.includes(':')) return isPrivateV6(host);
  return false;
}

const PRIVATE_V4_RULES: { a: number; b?: (b: number) => boolean }[] = [
  { a: 10 },
  { a: 127 },
  { a: 0 },
  { a: 169, b: b => b === 254 },
  { a: 172, b: b => b >= 16 && b <= 31 },
  { a: 192, b: b => b === 168 },
  { a: 100, b: b => b >= 64 && b <= 127 },
];

function isPrivateV4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  const a = parts[0] ?? NaN;
  const b = parts[1] ?? NaN;
  if (a >= 224) return true;
  return PRIVATE_V4_RULES.some(r => r.a === a && (r.b ? r.b(b) : true));
}

const PRIVATE_V6_EXACT = new Set(['::1', '::']);
const PRIVATE_V6_PREFIXES = ['fe80', 'fc', 'fd', 'ff'];

function mappedV4(x: string): string | undefined {
  const dotted = /::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x);
  if (dotted?.[1] !== undefined) return dotted[1];
  const hex = /::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(x);
  const hexHi = hex?.[1];
  const hexLo = hex?.[2];
  if (hexHi === undefined || hexLo === undefined) return undefined;
  const hi = parseInt(hexHi, 16);
  const lo = parseInt(hexLo, 16);
  return `${(hi >> 8) & 0xff}.${hi & 0xff}.${(lo >> 8) & 0xff}.${lo & 0xff}`;
}

function isPrivateV6(ip: string): boolean {
  const x = ip.toLowerCase().replace(/^\[|\]$/g, '');
  if (PRIVATE_V6_EXACT.has(x)) return true;
  if (PRIVATE_V6_PREFIXES.some(p => x.startsWith(p))) return true;
  const v4 = mappedV4(x);
  return v4 !== undefined ? isPrivateV4(v4) : false;
}

function isBlockedHost(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, '');
  if (BLOCKED_HOSTS.has(h)) return true;
  return BLOCKED_HOST_SUFFIXES.some(s => (s.startsWith('.') ? h.endsWith(s) : h === s));
}

export class SsrfError extends Error {}

async function drain(
  reader: ReadableStreamDefaultReader<Uint8Array>, maxBytes: number, reject: boolean,
): Promise<Uint8Array | null> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (reject && total + value.length > maxBytes) { void reader.cancel(); return null; }
    chunks.push(value);
    total += value.length;
    if (!reject && total >= maxBytes) { void reader.cancel(); break; }
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { out.set(c, off); off += c.length; }
  return out;
}

export async function readCappedBytes(
  res: Response, maxBytes: number, mode: 'truncate' | 'reject' = 'truncate',
): Promise<Uint8Array | null> {
  const reader = res.body?.getReader() as ReadableStreamDefaultReader<Uint8Array> | undefined;
  if (!reader) {
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength <= maxBytes) return buf;
    return mode === 'reject' ? null : buf.slice(0, maxBytes);
  }
  return drain(reader, maxBytes, mode === 'reject');
}

export async function readCappedText(
  res: Response, maxBytes: number, mode: 'truncate' | 'reject' = 'truncate',
): Promise<string | null> {
  if (!res.body) {
    const text = await res.text();
    if (new TextEncoder().encode(text).length <= maxBytes) return text;
    return mode === 'reject' ? null : text.slice(0, maxBytes);
  }
  const bytes = await readCappedBytes(res, maxBytes, mode);
  return bytes === null ? null : new TextDecoder('utf-8').decode(bytes);
}

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
