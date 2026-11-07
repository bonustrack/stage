const LOCAL_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.lan', '.home.arpa'];
const PRIVATE_V4: readonly (readonly [number, number, number])[] = [
  [0, 0, 255],
  [10, 0, 255],
  [127, 0, 255],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
  [100, 64, 127],
  [198, 18, 19],
];
const MULTICAST_AND_RESERVED_V4 = 224;
const PRIVATE_V6 = /^(?:f[c-f]|64:ff9b:|2002:|::ffff:0:)/;
const EMBEDDED_V4_DOTTED = /(?:^::|::ffff:)(\d+\.\d+\.\d+\.\d+)$/;
const EMBEDDED_V4_HEX = /(?:^::|::ffff:)([0-9a-f]{1,4}):([0-9a-f]{1,4})$/;
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/;

export interface HostPolicy {
  ipLiterals?: boolean;
  blockedDomains?: readonly string[];
}

export type HostProblem = 'local' | 'private-ip' | 'ip-literal';

function normalHost(hostname: string): string {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
}

function v4Octets(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function privateV4([a, b]: readonly number[]): boolean {
  if (a === undefined || b === undefined) return true;
  return a >= MULTICAST_AND_RESERVED_V4 || PRIVATE_V4.some(([first, low, high]) => a === first && b >= low && b <= high);
}

function embeddedV4(host: string): number[] | 'invalid' | null {
  const dotted = EMBEDDED_V4_DOTTED.exec(host)?.[1];
  if (dotted !== undefined) return v4Octets(dotted) ?? 'invalid';
  const hex = EMBEDDED_V4_HEX.exec(host);
  if (hex?.[1] === undefined || hex[2] === undefined) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255];
}

function privateV6(host: string): boolean {
  if (host === '::' || host === '::1' || PRIVATE_V6.test(host)) return true;
  const v4 = embeddedV4(host);
  return v4 === 'invalid' || (v4 !== null && privateV4(v4));
}

function privateAddress(host: string): boolean {
  if (host.includes(':')) return privateV6(host);
  const v4 = v4Octets(host);
  return v4 !== null && privateV4(v4);
}

function blockedName(host: string, blockedDomains: readonly string[]): boolean {
  if (!host.includes('.') || NUMERIC_LABEL.test(host.slice(host.lastIndexOf('.') + 1))) return true;
  if (LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  return blockedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

export function hostProblem(hostname: string, policy: HostPolicy = {}): HostProblem | null {
  const host = normalHost(hostname);
  if (host.includes(':') || v4Octets(host) !== null) {
    if (policy.ipLiterals === false) return 'ip-literal';
    return privateAddress(host) ? 'private-ip' : null;
  }
  return blockedName(host, policy.blockedDomains ?? []) ? 'local' : null;
}

export function isPublicHost(hostname: string, policy: HostPolicy = {}): boolean {
  return hostProblem(hostname, policy) === null;
}
