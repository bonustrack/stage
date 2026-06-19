/** x402 display helpers — pure, testable formatting for the x402 payment card.
 *
 *  The link-preview proxy returns an x402 challenge with amounts in the asset's
 *  ATOMIC (smallest) units and networks as CAIP-2 ids (`eip155:8453`) or legacy
 *  names (`base`). This module turns those into the human strings the card shows
 *  (amount + symbol, network label, chain number for the token avatar) using the
 *  small set of assets the wallet already knows. No network, no signing. */

import type { X402Accept } from './useLinkPreview';

/** Atomic-unit decimals + symbol for the assets we can label. Keyed by the
 *  asset's lowercased contract address. USDC (6) on every chain we care about. */
const KNOWN_ASSETS: Record<string, { symbol: string; decimals: number }> = {
  // USDC — Base, Ethereum, Sepolia, Base-Sepolia, OP, Arbitrum, Polygon, etc.
  '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': { symbol: 'USDC', decimals: 6 }, // Base
  '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { symbol: 'USDC', decimals: 6 }, // Ethereum
  '0x036cbd53842c5426634e7929541ec2318f3dcf7e': { symbol: 'USDC', decimals: 6 }, // Base Sepolia
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': { symbol: 'USDC', decimals: 6 }, // Sepolia
};

/** CAIP-2 / legacy network id -> { chainId, label } for the networks x402
 *  commonly runs on. Falls back gracefully for ids we don't recognise. */
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

/** Human label for a network id: a friendly name when known, else the raw id. */
export function x402NetworkLabel(network: string): string {
  return NETWORKS[netKey(network)]?.label ?? network;
}

/** Chain number for a network id (for the token avatar's network badge). The
 *  `eip155:<n>` form is parsed directly; defaults to 1 when unknown. */
export function x402ChainNumber(network: string): number {
  const known = NETWORKS[netKey(network)];
  if (known) return known.chainId;
  const m = /^eip155:(\d+)$/.exec(netKey(network));
  return m ? Number(m[1]) : 1;
}

/** The address the token avatar should resolve a logo for. Uses the challenge's
 *  asset contract; falls back to a zero sentinel so the avatar degrades to the
 *  border circle rather than crashing. */
export function x402AssetForAvatar(accept: X402Accept): string {
  return accept.asset ?? '0x0000000000000000000000000000000000000000';
}

/** Format an atomic-unit amount string by `decimals`, trimming trailing zeros.
 *  Pure string math so it never loses precision on large token amounts. */
export function formatAtomic(amount: string, decimals: number): string | undefined {
  if (!/^\d+$/.test(amount)) return undefined;
  if (decimals === 0) return amount;
  const padded = amount.padStart(decimals + 1, '0');
  const whole = padded.slice(0, padded.length - decimals);
  const frac = padded.slice(padded.length - decimals).replace(/0+$/, '');
  // Group the integer part with thousands separators for readability.
  const groupedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return frac ? `${groupedWhole}.${frac}` : groupedWhole;
}

/** The challenge's asset decimals/symbol, when we recognise the token. Used by
 *  the pay path to convert the atomic amount to whole units for the balance
 *  check, and to label the Pay button. */
export function x402KnownAsset(accept: X402Accept): { symbol: string; decimals: number } | undefined {
  return accept.asset ? KNOWN_ASSETS[accept.asset.toLowerCase()] : undefined;
}

/** Whether the in-app pay path can fulfil this challenge: the `exact` scheme on a
 *  network we know the chain id for, paying a known asset (USDC) we can label and
 *  balance-check, with a payTo + amount present. Anything else falls back to
 *  "Open endpoint". */
export function x402CanPayInApp(accept: X402Accept): boolean {
  if (accept.scheme !== 'exact') return false;
  if (!accept.payTo || !accept.amount || !accept.asset) return false;
  if (!NETWORKS[netKey(accept.network)]) return false;
  return !!x402KnownAsset(accept);
}

/** The requested amount in WHOLE units (for the balance comparison), or
 *  undefined when the asset/amount can't be resolved to a number.
 *
 *  Atomic amounts are integer strings; a non-integer (decimal/garbage) amount is
 *  a malformed challenge. We reuse `formatAtomic` (exact string math) which
 *  returns undefined for any non-integer / non-numeric amount, so a malformed
 *  challenge yields undefined here too — the card then can't show a payable
 *  state with a broken balance gate. Only the final comparison value is coerced
 *  to a Number. */
export function x402AmountNumber(accept: X402Accept): number | undefined {
  const asset = x402KnownAsset(accept);
  if (!asset || !accept.amount) return undefined;
  const whole = formatAtomic(accept.amount, asset.decimals);
  if (whole === undefined) return undefined;
  const n = Number(whole.replace(/,/g, ''));
  return Number.isFinite(n) ? n : undefined;
}

/** Sanitise an attacker-controlled token-name hint (`extra.name`) before it goes
 *  in a user-facing label: strip control + bidi/RTL-override chars (which can
 *  visually reorder the amount line into a spoof) and clamp the length. */
export function sanitizeTokenName(name: string): string {
  let out = "";
  for (const ch of name) {
    const c = ch.codePointAt(0);
    if (c === undefined) continue;
    // Drop C0/C1 controls, the bidi embedding/override/isolate marks
    // (U+202A-202E, U+2066-2069), zero-width chars (U+200B-200F) and the BOM
    // (U+FEFF), any of which can visually reorder or hide the amount line.
    if (c <= 0x1f) continue;
    if (c >= 0x7f && c <= 0x9f) continue;
    if (c >= 0x200b && c <= 0x200f) continue;
    if (c >= 0x202a && c <= 0x202e) continue;
    if (c >= 0x2066 && c <= 0x2069) continue;
    if (c === 0xfeff) continue;
    out += ch;
  }
  return out.trim().slice(0, 16);
}

/** The amount line for the card: "<amount> <SYMBOL>" when we can resolve the
 *  asset's decimals/symbol, else the raw atomic amount (still informative), else
 *  undefined when there's no amount at all. */
export function x402AmountLabel(accept: X402Accept): string | undefined {
  if (!accept.amount) return undefined;
  const asset = accept.asset ? KNOWN_ASSETS[accept.asset.toLowerCase()] : undefined;
  if (asset) {
    const formatted = formatAtomic(accept.amount, asset.decimals);
    return formatted ? `${formatted} ${asset.symbol}` : undefined;
  }
  // Unknown asset: show the raw atomic amount with whatever symbol hint we have.
  // `extra.name` is attacker-controlled — sanitise + clamp before display.
  const rawName = typeof accept.extra?.name === 'string' ? accept.extra.name : undefined;
  const extraName = rawName ? sanitizeTokenName(rawName) : undefined;
  return extraName ? `${accept.amount} ${extraName}` : accept.amount;
}
