const UNKNOWN_CLIENT = 'unknown';

export function clientIp(headers: { get(name: string): string | null }): string {
  return headers.get('cf-connecting-ip') ?? UNKNOWN_CLIENT;
}

function ipv6Groups(address: string): string[] {
  const [head = '', tail] = address.split('::');
  const left = head === '' ? [] : head.split(':');
  const right = tail === undefined || tail === '' ? [] : tail.split(':');
  const gap = tail === undefined ? 0 : Math.max(0, 8 - left.length - right.length);
  return [...left, ...Array.from({ length: gap }, () => '0'), ...right];
}

export function clientRateKey(ip: string): string {
  const address = ip.trim().toLowerCase();
  if (!address.includes(':')) return address;
  if (address.includes('.')) return address.slice(address.lastIndexOf(':') + 1);
  return `${ipv6Groups(address)
    .slice(0, 4)
    .map((group) => group.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
