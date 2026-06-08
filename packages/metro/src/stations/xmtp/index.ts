/** XMTP train — MULTI-ACCOUNT (P1, LIVE since 2026-05-29). */
//
// Boots N XMTP Clients from ~/.metro/xmtp-accounts.json (one per account); the
// previous single-account train is at ~/.metro/trains/xmtp.ts.bak (rollback:
// restore it + `metro trains restart xmtp`). See /tmp/p1-design/RUNBOOK.md.
//
// Lines are account-scoped metro://xmtp/<acct>/<conv>; legacy metro://xmtp/<conv>
// still parses (→ default account). Inbound events carry payload.account; an
// account with an `owner` sets `to`=owner so `--as=<owner>` sees only its feed.
// Outbound actions take an optional `account`. Account keys: { privateKey } (raw
// EOA; account 0 = existing XMTP_PRIVATE_KEY) or { derive:<i> } (HD index into a
// stored mnemonic; NOT the daemon key, index >= 1 by convention).
//
// PUSH (LIVE 2026-05-29): the wire format is the SINGLE SOURCE OF TRUTH from
// apps/app/lib/pushRegister.ts. A control DM `METRO_CTRL:register-push:{json}` is
// consumed daemon-side (never surfaced/pushed) and stores an FCM token scoped to
// the receiving account. Every real inbound message fans an FCM push to that
// account's tokens (own/echo + SILENT_TYPES + control DMs skipped). See xmtp-push.ts.

import { ConsentState } from '@xmtp/node-sdk';
import { accounts, bootAccount, loadAccounts, type Account } from './accounts.js';
import { emitInbound, envelope } from './emit.js';
import { groupNameFor } from './conv-name.js';
import { handleControlDm } from './push.js';
import { pushInbound } from './push-title.js';
import { handleCall } from './actions.js';

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try { const msg = JSON.parse(line); if (msg.op === 'call') void handleCall(msg); }
    catch (err) { process.stderr.write(`bad stdin line: ${(err as Error).message}\n`); }
  }
});

const SYNC_MS = Number(process.env.XMTP_SYNC_MS ?? '15000');
const SILENT_TYPES = new Set([
  'readReceipt', 'transactionReference', 'walletSendCalls', 'groupUpdated', 'group_updated',
]);

/** Run one account's sync timer + message stream, isolated so a crash in one
 *  account doesn't down the whole train. */
async function runAccount(acct: Account, idx: number): Promise<void> {
  const { id } = acct.cfg;
  try {
    await acct.client.conversations.syncAll([ConsentState.Allowed]);
    const initial = await acct.client.conversations.list();
    process.stderr.write(`xmtp[${id}]: synced ${initial.length} conversation(s) at boot\n`);
  } catch (err) { process.stderr.write(`xmtp[${id}] boot sync error: ${(err as Error).message}\n`); }

  // Per-account jitter (derived from account index, NOT random) so the accounts'
  // periodic syncAll calls do not fire simultaneously and double the load.
  const jitter = (idx % 6) * 5000;
  setInterval(async () => {
    try { await acct.client.conversations.syncAll([ConsentState.Allowed]); }
    catch (err) { process.stderr.write(`xmtp[${id}] sync error: ${(err as Error).message}\n`); }
  }, SYNC_MS + jitter).unref();

  // Message stream with reconnect + EXPONENTIAL BACKOFF: on stream throw, log and
  // retry with a delay that starts at 5s and doubles per consecutive failure up
  // to a 60s cap. Reset to 5s after a clean (re)subscribe or a received message,
  // so a transient throttle does not become a self-amplifying re-subscribe storm.
  const MIN_DELAY = 5000;
  const MAX_DELAY = 60000;
  let delay = MIN_DELAY;
  for (;;) {
    try {
      const stream = await acct.client.conversations.streamAllMessages({
        consentStates: [ConsentState.Allowed] });
      delay = MIN_DELAY; // clean (re)subscribe - reset backoff
      for await (const msg of stream) {
        delay = MIN_DELAY; // received a message - reset backoff
        if (!msg) continue;
        if (msg.senderInboxId === acct.client.inboxId) continue;        // own/echo
        if (SILENT_TYPES.has(msg.contentType?.typeId ?? '')) continue;  // silent types
        // F2: consume control DMs (METRO_CTRL:… plain text) — never chat, never push.
        if (handleControlDm(id, msg)) continue;
        const conv = await acct.client.conversations.getConversationById(msg.conversationId);
        if (!conv) continue;
        const env = envelope(id, msg, conv);
        // Stamp the group's display name as line_name/lineName so the app shows
        // a real title for group messages (esp. freshly-created request groups,
        // which arrive nameless). Cached + local-only read — no XMTP network.
        const name = await groupNameFor(msg.conversationId, conv);
        if (name) {
          env.line_name = name; env.lineName = name;
          // Also inside payload — emitInbound projects payload, and the app/feed
          // reads payload.lineName (matches the proven historical wire shape).
          const p = (env.payload ?? {}) as Record<string, unknown>;
          env.payload = { ...p, lineName: name };
        }
        emitInbound(id, env);
        // F1 + E1: fan an FCM push to THIS account's tokens for the inbound message.
        pushInbound(id, env, msg, conv);
      }
    } catch (err) {
      process.stderr.write(`xmtp[${id}] stream error (retry ${delay / 1000}s): ${(err as Error).message}\n`);
    }
    await new Promise(r => setTimeout(r, delay));
    delay = Math.min(delay * 2, MAX_DELAY); // backoff on consecutive failures
  }
}

const cfgs = loadAccounts();
for (const cfg of cfgs) {
  try { await bootAccount(cfg); }
  catch (err) { process.stderr.write(`xmtp[${cfg.id}] boot FAILED: ${(err as Error).message}\n`); }
}
if (accounts.size === 0) { process.stderr.write('xmtp: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(`xmtp train ready — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);

let acctIdx = 0;
for (const acct of accounts.values()) void runAccount(acct, acctIdx++);
