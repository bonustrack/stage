
import type { Eip712TypedData, SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

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

export interface SignConfirmSummary {
  highRisk: boolean;
  kindLabel: string;
  domainName?: string;
  chainId?: string;
  counterparty?: string;
  token?: string;
  primaryType?: string;
  fields?: { name: string; value: string }[];
  message?: string;
}

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

function fieldOf(message: Record<string, unknown> | undefined, keys: string[]): string | undefined {
  if (!message) return undefined;
  const lower = new Map(Object.keys(message).map(k => [k.toLowerCase(), k]));
  for (const want of keys) {
    const actual = lower.get(want.toLowerCase());
    if (actual != null) {
      const v = message[actual];
      if (typeof v === 'string' && v.length > 0) return v;
      if (v && typeof v === 'object') {
        const nested = fieldOf(v as Record<string, unknown>, keys);
        if (nested) return nested;
      }
    }
  }
  return undefined;
}

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

function deriveMessageFields(message: Record<string, unknown> | undefined): { name: string; value: string }[] | undefined {
  if (!message) return undefined;
  return Object.entries(message).slice(0, 6).map(([name, v]) => ({ name, value: fmtFieldValue(v) }));
}

function deriveTypedDataSummary(td: Eip712TypedData): SignConfirmSummary {
  const primary = (td.primaryType ?? '').trim();
  const risk = HIGH_RISK_PRIMARY_TYPES[primary.toLowerCase()];
  const domain = td.domain as { name?: unknown; chainId?: unknown; verifyingContract?: unknown } | undefined;
  const verifyingContract = toScalarString(domain?.verifyingContract);
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

export function deriveSignSummary(req: SignatureRequestContent): SignConfirmSummary {
  if (req.kind !== 'eip712' || !req.eip712) {
    return { highRisk: false, kindLabel: 'message', message: req.message };
  }
  return deriveTypedDataSummary(req.eip712);
}

function domLine(s: SignConfirmSummary): string {
  return s.domainName ? `\nApp: ${s.domainName}${s.chainId ? ` · chain ${s.chainId}` : ''}` : '';
}

function highRiskMessage(s: SignConfirmSummary, senderNote: string): string {
  const who = s.counterparty ? ` to ${s.counterparty}` : '';
  const tok = s.token ? `\nToken/contract: ${s.token}` : '';
  return `⚠️ This signature grants a ${s.kindLabel}${who}.${tok}${domLine(s)}\n`
    + 'Signing it can let someone move your assets later. Only sign if you fully trust the sender.'
    + senderNote;
}

function plainMessageBody(s: SignConfirmSummary, senderNote: string): string {
  const body = s.message?.trim();
  const shown = body
    ? `\n\nMessage:\n"${body.length > 300 ? `${body.slice(0, 300)}…` : body}"`
    : '';
  return `Sign this message?${shown}\nOnly sign if you trust the sender.${senderNote}`;
}

function typedDataBody(s: SignConfirmSummary, senderNote: string): string {
  const fieldLines = (s.fields ?? [])
    .filter(f => f.value)
    .map(f => `\n  ${f.name}: ${f.value}`)
    .join('');
  const content = fieldLines ? `\nFields:${fieldLines}` : '';
  return `Sign typed data (${s.primaryType ?? s.kindLabel})?${domLine(s)}${content}\n`
    + `Only sign if you trust the sender.${senderNote}`;
}

export function signConfirmMessage(s: SignConfirmSummary, description?: string): string {
  const desc = description?.trim();
  const senderNote = desc ? `\n\nSender's note (untrusted): "${desc}"` : '';
  if (s.highRisk) return highRiskMessage(s, senderNote);
  if (s.kindLabel === 'message') return plainMessageBody(s, senderNote);
  return typedDataBody(s, senderNote);
}
