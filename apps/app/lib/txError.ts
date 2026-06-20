
interface ViemErrorLike {
  shortMessage?: unknown;
  details?: unknown;
  metaMessages?: unknown;
  cause?: unknown;
  message?: unknown;
  name?: unknown;
}

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function isGeneric(s: string): boolean {
  const g = s.toLowerCase();
  return (
    g === 'rpc request failed.' ||
    g === 'rpc request failed' ||
    g === 'an error occurred.' ||
    g === 'http request failed.' ||
    g.startsWith('an unknown error')
  );
}

function humanize(s: string): string {
  if (/AA21/i.test(s)) return 'Gas sponsorship failed (account could not pay). Try again.';
  if (/AA2[3-4]/i.test(s) || /signature error/i.test(s)) return 'Signature rejected by the account. Try again.';
  if (/AA3[0-9]/i.test(s) || /paymaster/i.test(s)) return 'Gas sponsor declined this transaction (paymaster). It may be out of credit or this call is not allowed.';
  if (/insufficient funds/i.test(s)) return 'Insufficient funds for this transaction.';
  if (/user rejected|user denied|rejected the request/i.test(s)) return 'Request rejected.';
  if (/nonce/i.test(s)) return 'Transaction nonce conflict. Try again.';
  if (/timed out|timeout/i.test(s)) return 'The network timed out. Try again.';
  return s;
}

function metaMessage(e: ViemErrorLike): string | undefined {
  if (!Array.isArray(e.metaMessages)) return undefined;
  return str((e.metaMessages as unknown[]).map(m => str(m)).filter(Boolean).join(' '));
}

function pickMessage(candidate: string | undefined, msg: string | undefined): string | undefined {
  if (candidate && !isGeneric(candidate)) return candidate;
  if (msg && !isGeneric(msg)) return candidate ?? msg;
  return candidate ?? msg;
}

function collect(err: unknown, depth = 0): string | undefined {
  if (!err || depth > 6) return undefined;
  if (typeof err === 'string') return str(err);
  if (typeof err !== 'object') return undefined;
  const e = err as ViemErrorLike;
  const specific = str(e.details) ?? metaMessage(e) ?? str(e.shortMessage);
  const candidate = collect(e.cause, depth + 1) ?? specific;
  return pickMessage(candidate, str(e.message));
}

export function txErrorMessage(err: unknown, fallback: string): string {
  try {
    const raw = collect(err) ?? fallback;
    const out = humanize(raw);
    const trimmed = out.split('\n')[0]?.trim();
    const firstLine = trimmed !== undefined && trimmed.length > 0 ? trimmed : fallback;
    return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;
  } catch {
    return fallback;
  }
}
