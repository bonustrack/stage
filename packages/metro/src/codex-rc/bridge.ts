/** Standalone Codex bridge: attach a Codex CLI to an ALREADY-RUNNING daemon. */
/** Launched when `metro` has METRO_CODEX_RC but a healthy daemon already owns */
/** the socket — starting a second dispatcher would thrash the lock + trains. */
/** Instead it tails the shared history.jsonl, filters to the Codex CLI's own */
/** feed (same routing predicate as the in-dispatcher bridge), and forwards */
/** matching events to the Codex app-server over WS. */
/** Result: ONE daemon (all accounts), N CLIs each seeing only their own feed — */
/** Claude via `metro tail`, Codex via this bridge. */

import pkg from '../../package.json' with { type: 'json' };
import { CodexRC } from './client.js';
import { codexSelf, type HistoryEntry } from '../history.js';
import { setCodexSessionId } from '../local-identity.js';
import { log } from '../log.js';
import { loadMetroEnv } from '../paths.js';
import {
  drainTail, followTail, historySize, type TailOpts,
} from '../broker/history-stream.js';

/** Run the Codex bridge against the live daemon's history. Resolves only when */
/** the process is told to stop (SIGINT/SIGTERM/stdin close). */
export async function runCodexBridge(url: string): Promise<void> {
  loadMetroEnv();
  const self = codexSelf();
  if (!self) {
    log.warn({}, 'codex bridge: no Codex identity resolvable — nothing to forward; exiting');
    return;
  }

  const codexRc = new CodexRC(url, pkg.version);
  codexRc.onThread(id => setCodexSessionId(id));
  codexRc.start();
  log.info({ self, url }, 'codex bridge: attached to running daemon; forwarding own feed');

  /** Mirror the in-dispatcher gate: `--as=<codex-self> --strict` (mine-only). */
  const opts: TailOpts = { mode: 'mine-only', self };
  const forward = (e: HistoryEntry): void => { codexRc.push(JSON.stringify(e)); };

  /** Start at EOF so we don't replay history the Codex turn already saw. */
  let offset = historySize();
  offset = drainTail(offset, opts, forward);

  await new Promise<void>(resolve => {
    const stop = followTail(offset, opts, forward, 500);
    const finish = (): void => { stop(); codexRc.stop(); resolve(); };
    process.on('SIGINT', finish); process.on('SIGTERM', finish);
    process.stdin.on('end', finish).on('close', finish);
  });
}
