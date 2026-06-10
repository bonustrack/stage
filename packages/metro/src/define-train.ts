// defineTrain — train-authoring SDK (#13).
// Factors out shared train scaffolding (envelope shape, op:call→op:response
// protocol, stdin buffering, self-echo, account boot, FCM fan-out) so authors
// write only platform bits: `accounts`, `parseLine`, `onInbound`, `actions`.
// Pure transport, no platform deps: import { defineTrain } from '@metro-labs/metro/define-train';

/* ──────────── wire shapes (mirror src/trains/protocol.ts) ──────────── */

import type { WireEvent } from './history-types.js';

export type { WireEvent } from './history-types.js';

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
  /** Canonical content-type discriminator (see {@link WireEvent}). When set, the */
  /** dispatcher carries it verbatim to `HistoryEntry.event`; additive (omit ⇒ */
  /** byte-identical). Keep the legacy text (e.g. `[react 👍]`) alongside it. */
  event?: WireEvent;
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
  /** Boot accounts: one handle each. Omit for account-less trains (`accounts` map stays empty). */
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

/** Build (not start) a train. Used by `defineTrain` + tests to dispatch calls without stdin. */
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

/** Define + run a train: boot accounts, start the op:call pump, run the inbound loop (unawaited). */
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
