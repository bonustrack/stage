/** Structured train-error shape + helpers (#3). SINGLE SOURCE of the error
 *  channel: `trains/protocol.ts` (daemon) and `define-train.ts` (SDK) both
 *  re-export from here; the CLI reads `code` off {@link TrainErrorInfo}. */
// Dependency-free on purpose (define-train is "pure transport, no platform
// deps"): imports nothing. Mirrors the WireEvent single-source pattern.
// Additive: the legacy `error` string is ALWAYS emitted alongside `errorInfo`,
// so a caller ignoring `errorInfo` sees byte-identical output.

/** `code` — stable machine token (e.g. RATE_LIMITED, NOT_FOUND, INVALID_ARGS);
 *  callers branch on this, never on prose. `message` — human detail (mirrors the
 *  legacy `error` string). `retryable`/`retryAfterMs` — back-off hints. */
export type TrainErrorInfo = {
  code: string;
  message: string;
  retryable?: boolean;
  retryAfterMs?: number;
};

/** A typed error a handler may throw. Serializes (via {@link serializeTrainError})
 *  to the `op:response` `errorInfo` channel AND the legacy `error` string. Plain
 *  `Error`s keep today's behaviour exactly (legacy string only, no `errorInfo`). */
export class TrainError extends Error {
  readonly code: string;
  readonly retryable?: boolean;
  readonly retryAfterMs?: number;
  constructor(code: string, message: string, opts?: { retryable?: boolean; retryAfterMs?: number }) {
    super(message);
    this.name = 'TrainError';
    this.code = code;
    this.retryable = opts?.retryable;
    this.retryAfterMs = opts?.retryAfterMs;
  }
  toErrorInfo(): TrainErrorInfo {
    return {
      code: this.code,
      message: this.message,
      ...(this.retryable !== undefined ? { retryable: this.retryable } : {}),
      ...(this.retryAfterMs !== undefined ? { retryAfterMs: this.retryAfterMs } : {}),
    };
  }
}

/** Map any thrown value to an `op:response` error body. A {@link TrainError}
 *  yields `{ error, errorInfo }`; anything else yields only the legacy
 *  `{ error }` — byte-identical to pre-#3 behaviour. */
export function serializeTrainError(err: unknown): { error: string; errorInfo?: TrainErrorInfo } {
  if (err instanceof TrainError) return { error: err.message, errorInfo: err.toErrorInfo() };
  return { error: err instanceof Error ? err.message : String(err) };
}

/** Defensive parse of an inbound `errorInfo` (untrusted train stdout). Returns
 *  undefined unless it has a string `code` + string `message`. */
export function coerceErrorInfo(v: unknown): TrainErrorInfo | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const o = v as Record<string, unknown>;
  if (typeof o.code !== 'string' || typeof o.message !== 'string') return undefined;
  const info: TrainErrorInfo = { code: o.code, message: o.message };
  if (typeof o.retryable === 'boolean') info.retryable = o.retryable;
  if (typeof o.retryAfterMs === 'number') info.retryAfterMs = o.retryAfterMs;
  return info;
}
