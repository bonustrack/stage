/**
 * defineTrain — train-authoring SDK (#13).
 *
 * The reference trains (telegram/discord/xmtp) each hand-reimplement the same
 * scaffolding: the JSON envelope shape, the stdin `op:call` → stdout
 * `op:response` protocol, line-buffered stdin parsing, the self-echo of
 * outbound sends, multi-account boot, and (for xmtp) FCM fan-out. That's ~1000
 * lines of duplicated boilerplate across three files.
 *
 * `defineTrain({ accounts, parseLine, onInbound, actions })` factors all of that
 * out. A train author writes only the platform-specific bits:
 *   - `accounts`         : boot one client per configured account (optional —
 *                          single-account trains omit it).
 *   - `parseLine(line)`  : map a metro:// line back to a routing target.
 *   - `onInbound`        : the polling / streaming loop that calls `ctx.emit(...)`.
 *   - `actions`          : a map of action-name → handler. Return value is the
 *                          `result`; throwing becomes the `error`.
 *
 * The SDK owns: stdin draining, op:call dispatch + op:response bookkeeping,
 * error→response mapping, the inbound/outbound envelope helpers, SELF_URI
 * wiring, account boot fan-out, and optional FCM push fan-out.
 *
 * Pure transport — no platform deps. Import it from a train script:
 *   import { defineTrain } from '@metro-labs/metro/define-train';
 */

/* ──────────── wire shapes (mirror src/trains/protocol.ts) ──────────── */

export type Envelope = {
  kind?: 'inbound' | 'outbound';
  id?: string;
  ts?: string;
  station?: string;
  line: string;
  line_name?: string;
  from?: string;
  from_name?: string;
  to?: string;
  message_id?: string;
  reply_to?: string;
  is_private?: boolean;
  text?: string;
  emoji?: string;
  payload?: unknown;
  account?: string;
} & Record<string, unknown>;

export type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

/** A booted platform account. `id` is the metro account id; `client` is opaque. */
export type AccountHandle<Client> = { id: string; client: Client };

/** Context handed to every train hook. */
export type TrainContext<Client> = {
  /** This train's name (`METRO_TRAIN_NAME`). */
  readonly name: string;
  /** The daemon's self URI (`METRO_SELF_URI`) — `from` on outbound echoes. */
  readonly selfUri: string;
  /** Booted accounts, keyed by account id. Empty for single-account trains. */
  readonly accounts: ReadonlyMap<string, AccountHandle<Client>>;
  /** Mint a universal `msg_*` id. */
  mintId(): string;
  /** Emit a raw envelope. Stamps `id`/`ts`/`station` if absent. */
  emit(env: Partial<Envelope> & { line: string }): string;
  /** Emit an inbound event (kind:'inbound'). Returns the minted universal id. */
  emitInbound(env: Partial<Envelope> & { line: string }): string;
  /** Emit the self-echo of an outbound send (kind:'outbound'). Returns the universal id. */
  emitOutbound(env: Partial<Envelope> & { line: string; message_id: string }): string;
  /** Write a structured log line the supervisor surfaces (`op:'log'`). */
  log(text: string): void;
};

export type ActionHandler<Client> = (
  args: Record<string, unknown>,
  ctx: TrainContext<Client>,
) => unknown | Promise<unknown>;

export type DefineTrainOptions<Client> = {
  /** Train name override; defaults to METRO_TRAIN_NAME or 'train'. */
  name?: string;
  /**
   * Boot accounts. Return one handle per account. Omit for trains with no
   * account concept (the context's `accounts` map is then empty).
   */
  accounts?: (ctx: TrainContext<Client>) => Promise<AccountHandle<Client>[]> | AccountHandle<Client>[];
  /** Parse a metro:// line into a routing target (or null if it isn't ours). */
  parseLine?: (line: string) => unknown;
  /** The inbound loop: poll/stream the platform and call ctx.emit*. Long-running. */
  onInbound?: (ctx: TrainContext<Client>) => Promise<void> | void;
  /** Outbound action handlers. Throwing → op:response error. */
  actions: Record<string, ActionHandler<Client>>;
};

/** A running train you can introspect/stop (mostly for tests). */
export type RunningTrain<Client> = {
  ctx: TrainContext<Client>;
  /** Feed one raw stdin line (newline already stripped). Exposed for testing. */
  feedLine(line: string): void;
  /** Stop reading stdin. */
  stop(): void;
};

function mintIdImpl(): string {
  return `msg_${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Build (but do not start the stdin pump for) a train. Used by `defineTrain`
 * and directly by tests so the call-dispatch path can be exercised without a
 * real stdin. `write` defaults to stdout.
 */
export function buildTrain<Client>(
  opts: DefineTrainOptions<Client>,
  write: (s: string) => void = s => void process.stdout.write(s),
): { ctx: TrainContext<Client>; dispatch: (msg: CallMsg) => Promise<void>; boot: () => Promise<void> } {
  const name = opts.name ?? process.env.METRO_TRAIN_NAME ?? 'train';
  const selfUri = process.env.METRO_SELF_URI ?? '';
  const accounts = new Map<string, AccountHandle<Client>>();

  const emit = (env: Partial<Envelope> & { line: string }): string => {
    const id = typeof env.id === 'string' ? env.id : mintIdImpl();
    const { id: _ignored, ts, station, ...rest } = env;
    void _ignored;
    write(JSON.stringify({
      ...rest, id, ts: ts ?? new Date().toISOString(), station: station ?? name,
    }) + '\n');
    return id;
  };

  const ctx: TrainContext<Client> = {
    name,
    selfUri,
    accounts,
    mintId: mintIdImpl,
    emit,
    emitInbound: env => emit({ kind: 'inbound', from: selfUri, ...env }),
    emitOutbound: env => emit({ kind: 'outbound', from: selfUri, to: env.line, ...env }),
    log: text => write(JSON.stringify({ op: 'log', text }) + '\n'),
  };

  const respond = (id: string, body: { result?: unknown; error?: string }): void =>
    write(JSON.stringify({ op: 'response', id, ...body }) + '\n');

  const dispatch = async (msg: CallMsg): Promise<void> => {
    const handler = opts.actions[msg.action];
    if (!handler) {
      respond(msg.id, { error: `unknown action '${msg.action}' (have: ${Object.keys(opts.actions).join(', ')})` });
      return;
    }
    try {
      const result = await handler(msg.args ?? {}, ctx);
      respond(msg.id, { result: result ?? null });
    } catch (err) {
      respond(msg.id, { error: err instanceof Error ? err.message : String(err) });
    }
  };

  const boot = async (): Promise<void> => {
    if (opts.accounts) {
      for (const a of await opts.accounts(ctx)) accounts.set(a.id, a);
    }
  };

  return { ctx, dispatch, boot };
}

/**
 * Define + run a train: boots accounts, starts the stdin op:call pump, then
 * runs the inbound loop. Returns a handle (the inbound loop runs in the
 * background). This is the one call a train script makes.
 */
export async function defineTrain<Client = unknown>(
  opts: DefineTrainOptions<Client>,
): Promise<RunningTrain<Client>> {
  const { ctx, dispatch, boot } = buildTrain(opts);

  await boot();

  let buf = '';
  const onData = (chunk: string): void => {
    buf += chunk;
    let nl;
    while ((nl = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (line) feedLine(line);
    }
  };
  const feedLine = (line: string): void => {
    try {
      const msg = JSON.parse(line);
      if (msg && msg.op === 'call') void dispatch(msg as CallMsg);
    } catch (err) {
      process.stderr.write(`${ctx.name}: bad stdin line: ${(err as Error).message}\n`);
    }
  };

  process.stdin.setEncoding('utf8');
  process.stdin.on('data', onData);

  process.stderr.write(`${ctx.name} train ready (${ctx.accounts.size} account(s))\n`);

  /** Inbound loop runs unawaited — it's the long-lived poll/stream. */
  if (opts.onInbound) {
    void Promise.resolve(opts.onInbound(ctx)).catch(err =>
      process.stderr.write(`${ctx.name}: inbound loop crashed: ${(err as Error).message}\n`));
  }

  return {
    ctx,
    feedLine,
    stop: () => process.stdin.off('data', onData),
  };
}
