/** Telegram train — MULTI-BOT (mirrors the live multi-account xmtp train). */
//
// Boots N bots from ~/.metro/telegram-accounts.json (one long-poll loop per
// token). Lines are account-scoped metro://telegram/<acct>/<chatId>[/<topic>];
// legacy metro://telegram/<chatId> still parses (→ default/first account).
//
// Inbound events carry payload.account; if the account declares an `owner`, `to`
// is set to it so a session tailing `--as <owner> --strict` sees only that bot's
// feed (feed isolation). Outbound actions take an optional `account`.
//
// MULTI-BOT POLLING: getUpdates is scoped to one token, and different bots have
// different tokens, so N poll loops don't conflict — each sees only its bot. A
// 409 ("terminated by other getUpdates") happens only when two clients poll the
// SAME token or a webhook is set on a polled token. We therefore reject duplicate
// tokens at load and clear any stale webhook per token at boot.
//
// Back-compat: if telegram-accounts.json is absent, synthesizes one `default`
// account from $TELEGRAM_BOT_TOKEN (legacy lines).

import { accounts, loadAccounts, tg, type Account } from './accounts.js';
import { emit } from './wire.js';
import {
  emitInbound, envelope, reactionEnvelope, saveMediaAndEmit, type TgMsg, type TgReaction,
} from './format.js';
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

type Update = { update_id: number; message?: TgMsg; message_reaction?: TgReaction };

/** One account's poll loop, isolated so a crash in one bot doesn't down the train. */
async function runAccount(acct: Account): Promise<void> {
  const { id } = acct.cfg;
  // Clear any stale webhook so getUpdates won't 409. Each bot's token owns its own
  // webhook state, so this is per-account and safe.
  try { await tg(id, 'deleteWebhook', { drop_pending_updates: false }); }
  catch (err) { process.stderr.write(`telegram[${id}] deleteWebhook: ${(err as Error).message}\n`); }

  for (;;) {
    try {
      const updates = await tg<Update[]>(id, 'getUpdates',
        { offset: acct.offset, timeout: 25, allowed_updates: ['message', 'message_reaction'] }, 60_000);
      for (const u of updates) {
        acct.offset = u.update_id + 1;
        if (u.message && !u.message.from?.is_bot) {
          const env = envelope(id, u.message);
          emitInbound(emit, id, env);
          saveMediaAndEmit(emit, id, u.message, env.id as string);
        }
        if (u.message_reaction) {
          const env = reactionEnvelope(id, u.message_reaction);
          if (env) emitInbound(emit, id, env);
        }
      }
    } catch (err) {
      process.stderr.write(`telegram[${id}] poll error: ${(err as Error).message}\n`);
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
}

const cfgs = loadAccounts();
for (const cfg of cfgs) {
  accounts.set(cfg.id, {
    cfg,
    api: `https://api.telegram.org/bot${cfg.token}`,
    fileApi: `https://api.telegram.org/file/bot${cfg.token}`,
    offset: 0,
  });
}
if (accounts.size === 0) { process.stderr.write('telegram: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(
  `telegram train ready (multi) — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);

for (const acct of accounts.values()) void runAccount(acct);
