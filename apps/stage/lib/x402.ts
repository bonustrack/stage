
import type { X402Accept } from './useLinkPreview';

const KNOWN_ASSETS: Record<string, { symbol: string; decimals: number }> = {
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 },
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 },
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 },
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 },
};

const NETWORKS: Record<string, { chainId: number; label: string }> = {
  'eip155:8453': { chainId: 8453, label: 'Base' },
  base: { chainId: 8453, label: 'Base' },
  'eip155:84532': { chainId: 84532, label: 'Base Sepolia' },
  'base-sepolia': { chainId: 84532, label: 'Base Sepolia' },
  'eip155:1': { chainId: 1, label: 'Ethereum' },
  ethereum: { chainId: 1, label: 'Ethereum' },
  'eip155:11155111': { chainId: 11155111, label: 'Sepolia' },
  sepolia: { chainId: 11155111, label: 'Sepolia' },
  'eip155:10': { chainId: 10, label: 'Optimism' },
  'eip155:42161': { chainId: 42161, label: 'Arbitrum' },
  'eip155:137': { chainId: 137, label: 'Polygon' },
  'eip155:43114': { chainId: 43114, label: 'Avalanche' },
};

function netKey(network: string): string {
  return network.trim().toLowerCase();
}

export function x402NetworkLabel(network: string): string {
  return NETWORKS[netKey(network)]?.label ?? network;
}

export function x402ChainNumber(network: string): number {
  const known = NETWORKS[netKey(network)];
  if (known) return known.chainId;
  const m = /^eip155:(\d+)$/.exec(netKey(network));
  return m ? Number(m[1]) : 1;
}

export function x402AssetForAvatar(accept: X402Accept): string {
  return accept.asset ?? '0x0000000000000000000000000000000000000000';
}

export function formatAtomic(amount: string, decimals: number): string | undefined {
  if (!/^\d+$/.test(amount)) return undefined;
  if (decimals === 0) return amount;
  const padded = amount.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '');
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${groupedWhole}.${frac}` : groupedWhole;
}

export function x402KnownAsset(accept: X402Accept): { symbol: string; decimals: number } | undefined {
  return accept.asset ? KNOWN_ASSETS[accept.asset.toLowerCase()] : undefined;
}

export function x402CanPayInApp(accept: X402Accept): boolean {
  if (accept.scheme !== 'exact') return false;
  if (!accept.payTo || !accept.amount || !accept.asset) return false;
  if (!NETWORKS[netKey(accept.network)]) return false;
  return !!x402KnownAsset(accept);
}

export function x402AmountNumber(accept: X402Accept): number | undefined {
  const asset = x402KnownAsset(accept);
  if (!asset || !accept.amount) return undefined;
  const whole = formatAtomic(accept.amount, asset.decimals);
  if (whole === undefined) return undefined;
  const n = Number(whole.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

function isSpoofChar(c: number): boolean {
  return (
    c <= 0x1f ||
    (c >= 0x7f && c <= 0x9f) ||
    (c >= 0x200b && c <= 0x200f) ||
    (c >= 0x202a && c <= 0x202e) ||
    (c >= 0x2066 && c <= 0x2069) ||
    c === 0xfeff
  );
}

export function sanitizeTokenName(name: string): string {
  let out = '';
  for (const ch of name) {
    const c = ch.codePointAt(0);
    if (c === undefined) continue;
    if (isSpoofChar(c)) continue;
    out += ch;
  }
  return out.trim().slice(0, 16);
}

export function x402AmountLabel(accept: X402Accept): string | undefined {
  if (!accept.amount) return undefined;
  const asset = accept.asset ? KNOWN_ASSETS[accept.asset.toLowerCase()] : undefined;
  if (asset) {
    const formatted = formatAtomic(accept.amount, asset.decimals);
    return formatted ? `${formatted} ${asset.symbol}` : undefined;
  }
  const rawName = typeof accept.extra?.name === 'string' ? accept.extra.name : undefined;
  const extraName = rawName ? sanitizeTokenName(rawName) : undefined;
  return extraName ? `${accept.amount} ${extraName}` : accept.amount;
}
