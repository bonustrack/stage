/** @file Risk-decode + confirm-summary derivation for in-chat XMTP SIGNATURE requests (EIP-712 / personal_sign) from untrusted peers, warning on high-risk primaryTypes (Permit2, EIP-3009, Seaport); derived only from the typed-data structure, never the free-text description, and pure/synchronous so it is unit-testable. */

import type { Eip712TypedData, SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

/** EIP-712 primaryTypes granting a standing authorization an attacker could later use to move assets; any match is treated as high-risk with an explicit warning. Lowercased for case-insensitive match. */
const HIGH_RISK_PRIMARY_TYPES: Record<string, string> = {
  permit: 'token spending approval (Permit)',
  permitsingle: 'token spending approval (Permit2)',
  permitbatch: 'batch token spending approval (Permit2)',
  permitdetails: 'token spending approval (Permit2)',
  permittransferfrom: 'token transfer authorization (Permit2)',
  permitbatchtransferfrom: 'batch token transfer authorization (Permit2)',
  transferwithauthorization: 'gasless token transfer (EIP-3009)',
  receivewithauthorization: 'gasless token transfer (EIP-3009)',
  ordercomponents: 'NFT/asset order (Seaport)',
  order: 'NFT/asset order (Seaport)',
  bulkorder: 'bulk NFT/asset order (Seaport)',
  delegation: 'account delegation',
  safetx: 'Safe transaction',
};

/** The risk summary the confirm sheet renders. */
export interface SignConfirmSummary {
  /** A high-risk typed-data authorization (Permit/Seaport/EIP-3009/...) -> the sheet MUST show the warning + destructive button. */
  highRisk: boolean;
  /** Human label for the typed data's primaryType (e.g. "token spending approval (Permit2)"), or the raw primaryType / "message" otherwise. */
  kindLabel: string;
  /** EIP-712 domain name when present (e.g. "Uniswap Permit2"). */
  domainName?: string;
  /** Decimal chain id from the domain, when present. */
  chainId?: string;
  /** The spender / operator / recipient the authorization empowers, decoded from the message fields by primaryType. Undefined when not resolvable. */
  counterparty?: string;
  /** The token / verifying contract the authorization targets, when resolvable (domain.verifyingContract for permit-style, or a message `token` field). */
  token?: string;
  /** The EIP-712 primaryType verbatim (for the concrete "what you're signing" line on the confirm sheet, even for non-high-risk typed data). */
  primaryType?: string;
  /** Decoded top-level message fields (name -> compact value), so the user always sees the actual content being signed, not just a label. Capped for display. */
  fields?: { name: string; value: string }[];
  /** For a `personal` request: the literal message text being signed. */
  message?: string;
}

/** Stringify a domain scalar (name/chainId/verifyingContract) for display, preserving the prior String(v) output for scalars while avoiding an unguarded base-to-string on unknown; objects fall back to JSON. */
function toScalarString(v: unknown): string | undefined {
  if (v == null) return undefined;
  if (typeof v === 'object') {
    try { return JSON.stringify(v); } catch { return undefined; }
  }
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') {
    return String(v);
  }
  return undefined;
}

/** Pull the first string-valued field from `message` matching any candidate key (case-insensitive). Typed-data field names vary by standard. */
function fieldOf(message: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!message) return undefined;
  const lower = new Map(Object.keys(message).map(k => [k.toLowerCase(), k]));
  for (const want of keys) {
    const actual = lower.get(want.toLowerCase());
    if (actual != null) {
      const v = message[actual];
      if (typeof v === 'string' && v.length > 0) return v;
      /** Permit2 nests spender at the top level but token under `details`. */
      if (v && typeof v === 'object') {
        const nested = fieldOf(v as Record<string, unknown>, keys);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

/** Compactly stringify a single top-level message field value (capped to 80 chars) for the confirm sheet. */
function fmtFieldValue(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'object') {
    try { return JSON.stringify(v).slice(0, 80); } catch { return '[object Object]'.slice(0, 80); }
  }
  if (typeof v === 'string') return v.slice(0, 80);
  if (typeof v === 'symbol') return v.toString().slice(0, 80);
  if (typeof v === 'number' || typeof v === 'bigint' || typeof v === 'boolean') {
    return String(v).slice(0, 80);
  }
  try { return JSON.stringify(v).slice(0, 80); } catch { return ''; }
}

/** Flatten the top-level message into capped compact name:value pairs, or undefined when there is no message. */
function deriveMessageFields(message: Record<string, unknown> | undefined): { name: string; value: string }[] | undefined {
  if (!message) return undefined;
  return Object.entries(message).slice(0, 6).map(([name, v]) => ({ name, value: fmtFieldValue(v) }));
}

/** Build the full typed-data (eip712) confirm summary. */
function deriveTypedDataSummary(td: Eip712TypedData): SignConfirmSummary {
  const primary = (td.primaryType ?? '').trim();
  const risk = HIGH_RISK_PRIMARY_TYPES[primary.toLowerCase()];
  const domain = td.domain as { name?: unknown; chainId?: unknown; verifyingContract?: unknown } | undefined;
  const verifyingContract = toScalarString(domain?.verifyingContract);
  /** Decode the empowered counterparty + token from message fields. The exact keys differ per standard; we probe the common ones (Permit `spender`, Seaport `offerer`/`zone`, EIP-3009 `to`). */
  const counterparty = fieldOf(td.message, ['spender', 'operator', 'to', 'offerer', 'zone', 'delegate']);
  return {
    highRisk: !!risk,
    kindLabel: risk ?? (primary || 'typed data'),
    domainName: toScalarString(domain?.name),
    chainId: toScalarString(domain?.chainId),
    counterparty,
    token: fieldOf(td.message, ['token']) ?? verifyingContract,
    primaryType: primary || undefined,
    fields: deriveMessageFields(td.message),
  };
}

/** Derive the signature confirm summary from the typed-data STRUCTURE. For a `personal` request there's no structure to decode, so it's a low-risk plain-message sign. Never consults `description`. */
export function deriveSignSummary(req: SignatureRequestContent): SignConfirmSummary {
  if (req.kind !== 'eip712' || !req.eip712) {
    return { highRisk: false, kindLabel: 'message', message: req.message };
  }
  return deriveTypedDataSummary(req.eip712);
}

/** Format the optional "App: <name> · chain <id>" line for a summary, or '' when absent. */
function domLine(s: SignConfirmSummary): string {
  return s.domainName ? `\nApp: ${s.domainName}${s.chainId ? ` · chain ${s.chainId}` : ''}` : '';
}

/** Build the high-risk authorization warning body. */
function highRiskMessage(s: SignConfirmSummary, senderNote: string): string {
  const who = s.counterparty ? ` to ${s.counterparty}` : '';
  const tok = s.token ? `\nToken/contract: ${s.token}` : '';
  return `⚠️ This signature grants a ${s.kindLabel}${who}.${tok}${domLine(s)}\n`
    + `Signing it can let someone move your assets later. Only sign if you fully trust the sender.`
    + senderNote;
}

/** Build the plain personal-message confirm body. */
function plainMessageBody(s: SignConfirmSummary, senderNote: string): string {
  const body = s.message?.trim();
  const shown = body
    ? `\n\nMessage:\n"${body.length > 300 ? `${body.slice(0, 300)}…` : body}"`
    : '';
  return `Sign this message?${shown}\nOnly sign if you trust the sender.${senderNote}`;
}

/** Build the typed-data confirm body with decoded fields. */
function typedDataBody(s: SignConfirmSummary, senderNote: string): string {
  const fieldLines = (s.fields ?? [])
    .filter(f => f.value)
    .map(f => `\n  ${f.name}: ${f.value}`)
    .join('');
  const content = fieldLines ? `\nFields:${fieldLines}` : '';
  return `Sign typed data (${s.primaryType ?? s.kindLabel})?${domLine(s)}${content}\n`
    + `Only sign if you trust the sender.${senderNote}`;
}

/** Build the confirm Alert message from a derived summary: high-risk authorizations get an explicit warning naming what they grant and to whom, plain signs get a neutral line, and the peer-supplied description is appended separately and labelled untrusted. */
export function signConfirmMessage(s: SignConfirmSummary, description?: string): string {
  const desc = description?.trim();
  const senderNote = desc ? `\n\nSender's note (untrusted): "${desc}"` : '';
  if (s.highRisk) return highRiskMessage(s, senderNote);
  /** Concrete content the user is actually signing — never just the sender's label. */
  if (s.kindLabel === 'message') return plainMessageBody(s, senderNote);
  return typedDataBody(s, senderNote);
}
