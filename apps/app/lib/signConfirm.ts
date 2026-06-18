/** Risk-decode + confirm-summary derivation for in-chat SIGNATURE requests
 *  (audit HIGH/#1).
 *
 *  A signature request (EIP-712 typed data or a personal_sign string) arrives
 *  over XMTP from an UNTRUSTED peer. Unlike a payment, a signature moves no funds
 *  at sign-time, but a single tap can authorize a token allowance
 *  (Permit/Permit2), a gasless transfer (EIP-3009), or an NFT order (Seaport)
 *  that drains the wallet LATER. The peer also supplies a free-text `description`
 *  which is NOT bound to the typed data — a phishing request can label a Permit2
 *  "Sign in to claim your airdrop".
 *
 *  This module derives the confirm-sheet summary ONLY from the typed-data
 *  STRUCTURE (primaryType + the relevant message fields), never from the
 *  attacker-supplied `description`. For a recognised high-risk primaryType we
 *  surface an explicit warning naming the spender/operator + token, e.g.
 *  "This authorizes <spender> to spend your tokens (Permit2)". The description is
 *  passed through separately, clearly marked sender-provided/untrusted.
 *
 *  Pure + synchronous (no wallet, no network) so it is unit-testable. */

import type { Eip712TypedData, SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

/** EIP-712 primaryTypes that grant a standing authorization an attacker can
 *  later use to move assets. A signature for any of these is treated as
 *  high-risk and gets an explicit warning (never a friendly "sign in" line).
 *  Lowercased for case-insensitive match. */
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
  /** A high-risk typed-data authorization (Permit/Seaport/EIP-3009/...) -> the
   *  sheet MUST show the warning + destructive button. */
  highRisk: boolean;
  /** Human label for the typed data's primaryType (e.g. "token spending
   *  approval (Permit2)"), or the raw primaryType / "message" otherwise. */
  kindLabel: string;
  /** EIP-712 domain name when present (e.g. "Uniswap Permit2"). */
  domainName?: string;
  /** Decimal chain id from the domain, when present. */
  chainId?: string;
  /** The spender / operator / recipient the authorization empowers, decoded from
   *  the message fields by primaryType. Undefined when not resolvable. */
  counterparty?: string;
  /** The token / verifying contract the authorization targets, when resolvable
   *  (domain.verifyingContract for permit-style, or a message `token` field). */
  token?: string;
  /** The EIP-712 primaryType verbatim (for the concrete "what you're signing"
   *  line on the confirm sheet, even for non-high-risk typed data). */
  primaryType?: string;
  /** Decoded top-level message fields (name -> compact value), so the user always
   *  sees the actual content being signed, not just a label. Capped for display. */
  fields?: { name: string; value: string }[];
  /** For a `personal` request: the literal message text being signed. */
  message?: string;
}

/** Pull the first string-valued field from `message` matching any candidate key
 *  (case-insensitive). Typed-data field names vary by standard. */
function fieldOf(message: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!message) return undefined;
  const lower = new Map(Object.keys(message).map(k => [k.toLowerCase(), k]));
  for (const want of keys) {
    const actual = lower.get(want.toLowerCase());
    if (actual != null) {
      const v = message[actual];
      if (typeof v === 'string' && v.length > 0) return v;
      // Permit2 nests spender at the top level but token under `details`.
      if (v && typeof v === 'object') {
        const nested = fieldOf(v as Record<string, unknown>, keys);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

/** Derive the signature confirm summary from the typed-data STRUCTURE. For a
 *  `personal` request there's no structure to decode, so it's a low-risk
 *  plain-message sign. Never consults `description`. */
export function deriveSignSummary(req: SignatureRequestContent): SignConfirmSummary {
  if (req.kind !== 'eip712' || !req.eip712) {
    return { highRisk: false, kindLabel: 'message', message: req.message };
  }
  const td: Eip712TypedData = req.eip712;
  const primary = (td.primaryType ?? '').trim();
  const risk = HIGH_RISK_PRIMARY_TYPES[primary.toLowerCase()];
  const domain = td.domain as { name?: unknown; chainId?: unknown; verifyingContract?: unknown } | undefined;
  const domainName = domain?.name != null ? String(domain.name) : undefined;
  const chainId = domain?.chainId != null ? String(domain.chainId) : undefined;
  const verifyingContract = domain?.verifyingContract != null ? String(domain.verifyingContract) : undefined;
  /** Decode the empowered counterparty + token from message fields. The exact
   *  keys differ per standard; we probe the common ones (Permit `spender`,
   *  Seaport `offerer`/`zone`, EIP-3009 `to`). */
  const counterparty = fieldOf(td.message, ['spender', 'operator', 'to', 'offerer', 'zone', 'delegate']);
  const token = fieldOf(td.message, ['token']) ?? verifyingContract;
  /** Flatten the top-level message into compact name:value pairs so the sheet
   *  shows the concrete content being signed (capped to keep the alert readable). */
  const fields = td.message
    ? Object.entries(td.message).slice(0, 6).map(([name, v]) => ({
        name,
        value: ((): string => {
          if (v == null) return '';
          if (typeof v === 'object') {
            try { return JSON.stringify(v).slice(0, 80); } catch { return String(v); }
          }
          return String(v).slice(0, 80);
        })(),
      }))
    : undefined;
  return {
    highRisk: !!risk,
    kindLabel: risk ?? (primary || 'typed data'),
    domainName,
    chainId,
    counterparty,
    token,
    primaryType: primary || undefined,
    fields,
  };
}

/** Build the confirm Alert message from a derived summary. A high-risk
 *  authorization gets an explicit warning naming what it grants + to whom; a
 *  plain message/typed-data sign gets a neutral confirm line. The peer-supplied
 *  `description` is appended SEPARATELY and clearly labelled as sender-provided
 *  so it is never mistaken for the app's trusted summary. */
export function signConfirmMessage(s: SignConfirmSummary, description?: string): string {
  const desc = description?.trim();
  const senderNote = desc ? `\n\nSender's note (untrusted): "${desc}"` : '';
  if (s.highRisk) {
    const who = s.counterparty ? ` to ${s.counterparty}` : '';
    const tok = s.token ? `\nToken/contract: ${s.token}` : '';
    const dom = s.domainName ? `\nApp: ${s.domainName}${s.chainId ? ` · chain ${s.chainId}` : ''}` : '';
    return `⚠️ This signature grants a ${s.kindLabel}${who}.${tok}${dom}\n`
      + `Signing it can let someone move your assets later. Only sign if you fully trust the sender.`
      + senderNote;
  }
  // Concrete content the user is actually signing — never just the sender's label.
  if (s.kindLabel === 'message') {
    const body = s.message?.trim();
    const shown = body
      ? `\n\nMessage:\n"${body.length > 300 ? `${body.slice(0, 300)}…` : body}"`
      : '';
    return `Sign this message?${shown}\nOnly sign if you trust the sender.${senderNote}`;
  }
  const dom = s.domainName ? `\nApp: ${s.domainName}${s.chainId ? ` · chain ${s.chainId}` : ''}` : '';
  const fieldLines = (s.fields ?? [])
    .filter(f => f.value)
    .map(f => `\n  ${f.name}: ${f.value}`)
    .join('');
  const content = fieldLines ? `\nFields:${fieldLines}` : '';
  return `Sign typed data (${s.primaryType ?? s.kindLabel})?${dom}${content}\n`
    + `Only sign if you trust the sender.${senderNote}`;
}
