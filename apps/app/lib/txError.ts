/** Turn a thrown signing / userOp / RPC error into a SHORT, SPECIFIC message
 *  for the in-chat toast.
 *
 *  Why this exists: viem and the ZeroDev bundler/paymaster wrap the real reason
 *  inside a `BaseError` chain. The OUTER error's `.message` is almost always the
 *  generic "RPC Request failed." — useless to the user. The actual cause (e.g.
 *  "AA33 reverted: paymaster policy", "AA21 didn't pay prefund", "insufficient
 *  funds", a paymaster sponsorship rejection) lives in the inner error's
 *  `details` / `shortMessage` / `metaMessages`, or further down the `cause`
 *  chain. We walk that chain and surface the most specific human string we find,
 *  falling back to a clear generic instead of crashing or showing the opaque
 *  outer message. This NEVER throws. */

/** Fields viem's `BaseError` adds on top of `Error`. Optional + read
 *  defensively — the thrown value may be any shape. */
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

/** Generic outer messages we want to skip in favour of the inner cause. */
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

/** Map well-known AA / wallet failure codes to plain language. */
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

/** Walk the error + its `cause` chain, collecting the most specific strings.
 *  Bounded depth so a self-referential cause can't loop. */
function collect(err: unknown, depth = 0): string | undefined {
  if (!err || depth > 6) return undefined;
  if (typeof err === 'string') return str(err);
  if (typeof err !== 'object') return undefined;
  const e = err as ViemErrorLike;
  // Prefer the cause's specific reason first (deepest is usually most precise),
  // then this level's specific fields, before any generic message.
  const fromCause = collect(e.cause, depth + 1);
  const meta = Array.isArray(e.metaMessages)
    ? str((e.metaMessages as unknown[]).map(m => str(m)).filter(Boolean).join(' '))
    : undefined;
  const specific = str(e.details) ?? meta ?? str(e.shortMessage);
  const candidate = fromCause ?? specific;
  if (candidate && !isGeneric(candidate)) return candidate;
  const msg = str(e.message);
  if (msg && !isGeneric(msg)) return candidate ?? msg;
  return candidate ?? msg;
}

/** Public: best-effort short message for a toast. `fallback` is used when we
 *  can't extract anything meaningful. Never throws. */
export function txErrorMessage(err: unknown, fallback: string): string {
  try {
    const raw = collect(err) ?? fallback;
    const out = humanize(raw);
    // Keep it toast-sized: first line, capped.
    const trimmed = out.split('\n')[0]?.trim();
    const firstLine = trimmed !== undefined && trimmed.length > 0 ? trimmed : fallback;
    return firstLine.length > 140 ? `${firstLine.slice(0, 137)}...` : firstLine;
  } catch {
    return fallback;
  }
}
