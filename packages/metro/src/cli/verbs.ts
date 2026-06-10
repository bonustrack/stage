/** Themed porcelain CLI surface (migration step 5): shared helpers for the
 *  first-class noun-verb commands. Additive thin wrappers over the existing
 *  forward-call path; the new surface is the uniform envelope/--quiet/EXIT codes. */

import { errMsg } from '../log.js';
import { ipcCall } from '../ipc.js';
import { mintIdempotencyKey } from '../outbox.js';
import { isMutateCall } from '../outbox-driver.js';
import { enforceSendGuard } from './send-guard.js';
import { exitErr, isJson, writeJson, type ExitErr, type Flags } from './util.js';

/** Deterministic exit codes for the themed surface. 0-4 match the legacy CLI
 *  (see docs/cli.md); 7 is the new rate-limited signal called out in the doc. */
export const EXIT = {
  ok: 0,
  usage: 1,
  config: 2,
  upstream: 3,
  daemonDown: 4,
  rateLimited: 7,
} as const;

/** A forward-call result, narrowed to the daemon's success/error union. */
type CallResult = Record<string, unknown> | null;

/** Map a thrown error to an exit code, detecting rate-limit upstream errors so
 *  they surface as code 7 rather than a generic upstream 3. */
function codeFor(err: unknown): number {
  const explicit = (err as ExitErr).code;
  if (typeof explicit === 'number') return explicit;
  if (/rate.?limit|429|too many requests/i.test(errMsg(err))) return EXIT.rateLimited;
  return EXIT.upstream;
}

/** Forward an action to a train and return its raw result (or throw an ExitErr
 *  carrying the right exit code). Identical wire path to `metro call`. */
export async function forwardCall(
  train: string, action: string, args: Record<string, unknown>,
): Promise<CallResult> {
  enforceSendGuard(train, action, args);
  /** Mint an idempotency key for MUTATE verbs so the daemon's outbox can journal +
   *  dedup the send; READ verbs leave it unset (no journal entry). Additive. */
  const idempotencyKey = isMutateCall(train, action) ? mintIdempotencyKey() : undefined;
  let resp;
  try { resp = await ipcCall({ op: 'forward-call', train, action, args, idempotencyKey }); }
  catch (err) { throw exitErr(errMsg(err), EXIT.daemonDown); }
  if (!resp.ok) throw exitErr(resp.error, EXIT.upstream);
  if (!('response' in resp)) throw exitErr('daemon returned malformed forward-call response', EXIT.upstream);
  if (resp.response.error) {
    const e = exitErr(`${train}: ${resp.response.error}`, EXIT.upstream);
    e.code = /rate.?limit|429|too many requests/i.test(resp.response.error)
      ? EXIT.rateLimited : EXIT.upstream;
    throw e;
  }
  return (resp.response.result ?? null) as CallResult;
}

/** Best-effort id extraction for --quiet output. */
function pickId(result: CallResult): string {
  if (result && typeof result === 'object') {
    for (const k of ['id', 'messageId', 'threadId', 'line']) {
      const v = (result as Record<string, unknown>)[k];
      if (typeof v === 'string' && v) return v;
    }
  }
  return '';
}

/** Run a porcelain verb and render its result with the uniform envelope.
 *  default → human line; --json → {ok:true,command,result} (or the {ok:false,…}
 *  envelope on the thrown ExitErr, rendered centrally in index.ts); --quiet → id. */
export async function runVerb(
  command: string,
  f: Flags,
  run: () => Promise<CallResult>,
  human: (result: CallResult) => string,
): Promise<void> {
  let result: CallResult;
  try {
    result = await run();
  } catch (err) {
    // Re-throw with the resolved exit code AND the command tag so the central
    // handler in index.ts can render the uniform `{ ok:false, command, … }`
    // envelope. We never write here, to avoid double output.
    const e = exitErr(errMsg(err), codeFor(err));
    e.command = command;
    throw e;
  }
  if (isJson(f)) return writeJson({ ok: true, command, result });
  if (f.quiet === true) return void process.stdout.write(`${pickId(result)}\n`);
  process.stdout.write(`${human(result)}\n`);
}

/** Require a positional arg and return it, or throw a usage error (code 1). */
export function requireArg(p: string[], i: number, usage: string): string {
  const v = p[i];
  if (v === undefined || v === '') throw exitErr(`usage: ${usage}`, EXIT.usage);
  return v;
}
