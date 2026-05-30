/**
 * Typed metro-call + METRO_CTRL schema (#16).
 *
 * The control verbs that flow over the wire — both as outbound action-call args
 * (`metro call xmtp register-push '{…}'`) and as in-band METRO_CTRL DM payloads
 * (`METRO_CTRL:register-push:{json}`) — were previously stringly-typed JSON that
 * each train re-parsed and re-validated by hand. This module publishes ONE
 * lightweight runtime-validated schema so the CLI and the trains validate
 * identically.
 *
 * Zero-dependency: a tiny validator combinator (no zod) so trains stay
 * dependency-light and the same code runs CLI-side and train-side.
 */

/* ──────────── tiny runtime validator ──────────── */

export type Validator<T> = (v: unknown, path?: string) => T;
export class SchemaError extends Error {
  constructor(public path: string, public expected: string, public got: unknown) {
    super(`${path || 'value'}: expected ${expected}, got ${describe(got)}`);
    this.name = 'SchemaError';
  }
}
function describe(v: unknown): string {
  if (v === null) return 'null';
  if (Array.isArray(v)) return 'array';
  return typeof v;
}

export const v = {
  string: (opts?: { min?: number; max?: number }): Validator<string> => (val, path = '') => {
    if (typeof val !== 'string') throw new SchemaError(path, 'string', val);
    if (opts?.min !== undefined && val.length < opts.min) throw new SchemaError(path, `string ≥ ${opts.min} chars`, val);
    if (opts?.max !== undefined && val.length > opts.max) throw new SchemaError(path, `string ≤ ${opts.max} chars`, val);
    return val;
  },
  number: (): Validator<number> => (val, path = '') => {
    if (typeof val !== 'number' || !Number.isFinite(val)) throw new SchemaError(path, 'finite number', val);
    return val;
  },
  boolean: (): Validator<boolean> => (val, path = '') => {
    if (typeof val !== 'boolean') throw new SchemaError(path, 'boolean', val);
    return val;
  },
  literal: <const L extends string>(...lits: L[]): Validator<L> => (val, path = '') => {
    if (typeof val !== 'string' || !lits.includes(val as L)) throw new SchemaError(path, `one of ${lits.map(l => `'${l}'`).join(', ')}`, val);
    return val as L;
  },
  array: <T>(item: Validator<T>): Validator<T[]> => (val, path = '') => {
    if (!Array.isArray(val)) throw new SchemaError(path, 'array', val);
    return val.map((x, i) => item(x, `${path}[${i}]`));
  },
  optional: <T>(inner: Validator<T>): Validator<T | undefined> => (val, path = '') =>
    val === undefined || val === null ? undefined : inner(val, path),
  /** Object with a fixed shape. Unknown keys are dropped. */
  object: <S extends Record<string, Validator<unknown>>>(shape: S): Validator<{ [K in keyof S]: ReturnType<S[K]> }> =>
    (val, path = '') => {
      if (typeof val !== 'object' || val === null || Array.isArray(val)) throw new SchemaError(path, 'object', val);
      const src = val as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(shape)) out[k] = shape[k](src[k], path ? `${path}.${k}` : k);
      return out as { [K in keyof S]: ReturnType<S[K]> };
    },
};

/* ──────────── METRO_CTRL prefix (shared with apps/app/lib/pushRegister.ts) ──────────── */

export const METRO_CTRL_PREFIX = 'METRO_CTRL:';
export const isControlPayload = (text: unknown): text is string =>
  typeof text === 'string' && text.startsWith(METRO_CTRL_PREFIX);

/** Split a `METRO_CTRL:<verb>:<json>` body into `{ verb, json }`. Returns null if not a control payload. */
export function parseControl(text: unknown): { verb: string; rawJson: string } | null {
  if (!isControlPayload(text)) return null;
  const rest = text.slice(METRO_CTRL_PREFIX.length);
  const colon = rest.indexOf(':');
  if (colon === -1) return { verb: rest, rawJson: '' };
  return { verb: rest.slice(0, colon), rawJson: rest.slice(colon + 1) };
}

/* ──────────── verb schemas ──────────── */

/** register-push payload — identical shape whether sent as a call arg or a METRO_CTRL DM. */
export const RegisterPushSchema = v.object({
  token: v.string({ min: 20 }),
  account: v.optional(v.string()),
  platform: v.optional(v.string()),
  inboxId: v.optional(v.string()),
  address: v.optional(v.string()),
  v: v.optional(v.number()),
});
export type RegisterPush = ReturnType<typeof RegisterPushSchema>;

export const UnregisterPushSchema = v.object({ token: v.string({ min: 1 }) });
export const TestPushSchema = v.object({
  title: v.optional(v.string()),
  body: v.optional(v.string()),
  account: v.optional(v.string()),
});

/** Map of control verb → validator. Trains + CLI both look verbs up here. */
export const CTRL_SCHEMAS = {
  'register-push': RegisterPushSchema,
  'unregister-push': UnregisterPushSchema,
  'test-push': TestPushSchema,
} as const satisfies Record<string, Validator<unknown>>;

export type CtrlVerb = keyof typeof CTRL_SCHEMAS;
export const isKnownCtrlVerb = (verb: string): verb is CtrlVerb =>
  Object.prototype.hasOwnProperty.call(CTRL_SCHEMAS, verb);

/**
 * Validate a control payload. Accepts either a parsed object (call-arg path) or
 * a raw JSON string (METRO_CTRL DM path). Returns the typed value or throws
 * SchemaError. Unknown verbs throw — callers that want to ignore them should
 * gate on `isKnownCtrlVerb` first.
 */
export function validateCtrl(verb: string, payload: unknown): unknown {
  if (!isKnownCtrlVerb(verb)) throw new Error(`unknown control verb '${verb}'`);
  const obj = typeof payload === 'string' ? (payload ? JSON.parse(payload) : {}) : payload;
  return CTRL_SCHEMAS[verb](obj, verb);
}

/** Convenience: parse + validate a `METRO_CTRL:…` DM body in one step. */
export function parseAndValidateControl(text: unknown): { verb: CtrlVerb; value: unknown } | null {
  const parsed = parseControl(text);
  if (!parsed || !isKnownCtrlVerb(parsed.verb)) return null;
  return { verb: parsed.verb, value: validateCtrl(parsed.verb, parsed.rawJson) };
}
