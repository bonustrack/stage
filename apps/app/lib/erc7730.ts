/** ERC-7730 "clear signing" enrichment (offline, bundled).
 *
 *  ERC-7730 descriptors map a contract function / EIP-712 message to human
 *  labels + an intent + per-field formats (amount, addressName, date, raw). This
 *  module reads a CURATED, BUNDLED subset (see lib/erc7730/descriptors/*.json,
 *  normalized + trimmed from the LedgerHQ clear-signing registry) and resolves a
 *  descriptor for a given (chainId,address) calldata target or an EIP-712
 *  (domain,primaryType). It is PURE + in-memory cached and does ZERO network at
 *  runtime — a miss simply returns null and the caller keeps its current
 *  raw/ABI-only render. It is additive enrichment, never a gate on signing.
 *
 *  Path syntax in bundled descriptors is intentionally simple so it resolves
 *  offline against already-decoded values:
 *   - calldata field paths index decoded args positionally ("1", or "0.4" for a
 *     tuple member). `tokenPath` "@self" = the call target itself is the token;
 *     a numeric path = an address arg naming the token.
 *   - message field paths are dot paths into the EIP-712 message object
 *     ("details.amount"). `tokenPath` "@verifyingContract" = domain
 *     verifyingContract is the token; a dot path = the token address field. */

import { formatUnits, getAddress } from 'viem';

import calldataBundle from './erc7730/descriptors/calldata.json';
import messageBundle from './erc7730/descriptors/messages.json';

export type FieldFormat = 'raw' | 'amount' | 'addressName' | 'date' | 'tokenAmount';

/** One display field of a descriptor format. */
export interface DescriptorField {
  path: string;
  label: string;
  format: FieldFormat;
  /** For tokenAmount: where the token (for decimals/symbol) comes from. */
  tokenPath?: string;
}

/** A calldata function format keyed by canonical "name(type,...)" signature. */
interface CalldataFormat {
  intent: string;
  label: string;
  fields?: DescriptorField[];
}
interface CalldataDescriptor {
  id: string;
  owner: string;
  addresses: TokenEntry[];
  functions: Record<string, CalldataFormat>;
}

/** An EIP-712 message format keyed by primaryType (+ optional domain match). */
interface MessageDescriptor {
  id: string;
  owner: string;
  primaryType: string;
  domainName?: string;
  verifyingContract?: string;
  intent: string;
  fields: DescriptorField[];
}

export interface TokenEntry {
  chainId: number;
  address: string;
  symbol?: string;
  decimals?: number;
}

/** Resolved calldata descriptor for a matched (chainId,address)+selector. */
export interface CalldataMatch {
  owner: string;
  intent: string;
  label: string;
  fields: DescriptorField[];
  /** decimals/symbol of the descriptor's own token entry (for @self amounts). */
  self?: TokenEntry;
}

/** Resolved EIP-712 message descriptor. */
export interface MessageMatch {
  owner: string;
  intent: string;
  primaryType: string;
  fields: DescriptorField[];
}

const calldata = calldataBundle as unknown as { descriptors: CalldataDescriptor[] };
const messages = messageBundle as unknown as {
  descriptors: MessageDescriptor[];
  tokens: TokenEntry[];
};

const norm = (a: string): string => a.trim().toLowerCase();

/** Index (chainId:address)->descriptor and a token table, built once. */
let calldataIndex: Map<string, CalldataDescriptor> | null = null;
let tokenIndex: Map<string, TokenEntry> | null = null;

function buildIndex(): void {
  calldataIndex = new Map();
  tokenIndex = new Map();
  for (const d of calldata.descriptors) {
    for (const a of d.addresses) {
      calldataIndex.set(`${a.chainId}:${norm(a.address)}`, d);
      tokenIndex.set(`${a.chainId}:${norm(a.address)}`, a);
    }
  }
  for (const t of messages.tokens) tokenIndex.set(`${t.chainId}:${norm(t.address)}`, t);
}

function tokenFor(chainId: number, address?: string): TokenEntry | undefined {
  if (!address) return undefined;
  if (!tokenIndex) buildIndex();
  return tokenIndex!.get(`${chainId}:${norm(address)}`);
}

/** A single decoded calldata signature: "name(type,...)" with bare types. Mirrors
 *  the `signature` that txDecode produces, made canonical (no spaces/arg names). */
function canonicalSig(signature?: string): string | undefined {
  if (!signature) return undefined;
  const m = /^([^(]+)\((.*)\)$/s.exec(signature.trim());
  if (!m) return undefined;
  const name = m[1].trim();
  // Strip arg names + whitespace from each top-level param, keep nested tuples.
  const types = stripParamNames(m[2]);
  return `${name}(${types})`;
}

/** Strip param names from a (possibly tuple-nested) ABI param list, keeping only
 *  types. "address _to, uint256 _value" -> "address,uint256"; tuples preserved. */
function stripParamNames(params: string): string {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of params) {
    if (ch === '(') { depth++; cur += ch; continue; }
    if (ch === ')') { depth--; cur += ch; continue; }
    if (ch === ',' && depth === 0) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur);
  return out.map(stripOne).join(',');
}
function stripOne(p: string): string {
  const t = p.trim();
  // A tuple "(...) name" or "(...)[] name": keep the parenthesized type (+ array
  // suffix), drop the trailing name.
  const tup = /^(\(.*\)(?:\[\d*\])*)/s.exec(t);
  if (tup) return stripTupleNames(tup[1]);
  // Plain "type name" -> "type".
  return t.split(/\s+/)[0];
}
function stripTupleNames(t: string): string {
  const m = /^\((.*)\)((?:\[\d*\])*)$/s.exec(t);
  if (!m) return t;
  return `(${stripParamNames(m[1])})${m[2]}`;
}

/** Lookup a calldata descriptor for a contract call. Returns the matched format
 *  (intent + labelled fields) or null. `signature` is txDecode's signature
 *  (e.g. "transfer(address _to, uint256 _value)"). */
export function lookupDescriptor(args: {
  chainId: number;
  address?: string;
  signature?: string;
}): CalldataMatch | null {
  const { chainId, address, signature } = args;
  if (!address) return null;
  if (!calldataIndex) buildIndex();
  const d = calldataIndex!.get(`${chainId}:${norm(address)}`);
  if (!d) return null;
  const sig = canonicalSig(signature);
  if (!sig) return null;
  const fmt = d.functions[sig];
  if (!fmt) return null;
  return {
    owner: d.owner,
    intent: fmt.intent,
    label: fmt.label,
    fields: fmt.fields ?? [],
    self: tokenFor(chainId, address),
  };
}

/** Lookup an EIP-712 message descriptor by primaryType, narrowing on the domain
 *  name / verifyingContract when the descriptor specifies one. Returns null on
 *  miss. */
export function lookupMessageDescriptor(args: {
  primaryType?: string;
  domain?: { name?: unknown; verifyingContract?: unknown };
}): MessageMatch | null {
  const primary = (args.primaryType ?? '').trim();
  if (!primary) return null;
  const name = args.domain?.name != null ? String(args.domain.name) : undefined;
  const vc = args.domain?.verifyingContract != null ? norm(String(args.domain.verifyingContract)) : undefined;
  let best: MessageDescriptor | undefined;
  for (const d of messages.descriptors) {
    if (d.primaryType !== primary) continue;
    // A descriptor that pins a verifyingContract/domainName must match it.
    if (d.verifyingContract && d.verifyingContract !== vc) continue;
    if (d.domainName && name != null && d.domainName !== name) continue;
    // Prefer the most specific match (pins verifyingContract, then domainName).
    if (!best || (d.verifyingContract && !best.verifyingContract)
      || (d.domainName && !best.domainName && !best.verifyingContract)) best = d;
  }
  if (!best) return null;
  return { owner: best.owner, intent: best.intent, primaryType: best.primaryType, fields: best.fields };
}

/** Format a value per a field format. `ctx` carries the token (decimals/symbol)
 *  for tokenAmount. Returns a display string; falls back to the raw string on any
 *  problem so it is never worse than the unformatted value. */
export function formatField(
  value: unknown,
  format: FieldFormat,
  ctx?: { token?: TokenEntry },
): string {
  const raw = stringify(value);
  try {
    switch (format) {
      case 'addressName':
        return /^0x[0-9a-fA-F]{40}$/.test(raw) ? getAddress(raw) : raw;
      case 'date': {
        const secs = Number(BigInt(raw));
        if (!Number.isFinite(secs) || secs <= 0) return raw;
        return new Date(secs * 1000).toISOString().replace('T', ' ').slice(0, 16) + ' UTC';
      }
      case 'amount': {
        // Native value in wei.
        return `${formatUnits(BigInt(raw), 18)} ETH`;
      }
      case 'tokenAmount': {
        const dec = ctx?.token?.decimals ?? 18;
        const sym = ctx?.token?.symbol;
        const amt = formatUnits(BigInt(raw), dec);
        return sym ? `${amt} ${sym}` : amt;
      }
      default:
        return raw;
    }
  } catch {
    return raw;
  }
}

/** Resolve the token entry for a field's `tokenPath` against a calldata match. */
export function tokenForCalldataField(
  field: DescriptorField,
  match: CalldataMatch,
  chainId: number,
  argAddress?: string,
): TokenEntry | undefined {
  if (field.format !== 'tokenAmount') return undefined;
  if (field.tokenPath === '@self') return match.self;
  return tokenFor(chainId, argAddress);
}

/** Resolve the token entry for an EIP-712 field's `tokenPath`. */
export function tokenForMessageField(
  field: DescriptorField,
  chainId: number,
  verifyingContract?: string,
  tokenAddress?: string,
): TokenEntry | undefined {
  if (field.format !== 'tokenAmount') return undefined;
  if (field.tokenPath === '@verifyingContract') return tokenFor(chainId, verifyingContract);
  return tokenFor(chainId, tokenAddress);
}

function stringify(v: unknown): string {
  if (typeof v === 'bigint') return v.toString();
  if (v == null) return '';
  return String(v);
}
