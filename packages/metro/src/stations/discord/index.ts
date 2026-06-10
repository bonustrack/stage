/** Discord train — MULTI-BOT (mirrors the live multi-account xmtp train). */
//
// Boots N discord.js Clients from ~/.metro/discord-accounts.json (one gateway per
// token). Lines are account-scoped metro://discord/<acct>/<channelId>; legacy
// metro://discord/<channelId> still parses (→ default/first account).
//
// Inbound events carry payload.account; if the account declares an `owner`, `to`
// is set to it so a session tailing `--as <owner> --strict` sees only that bot's
// feed (feed isolation). Outbound actions take an optional `account`.
//
// Back-compat: if discord-accounts.json is absent, synthesizes one `default`
// account from $DISCORD_BOT_TOKEN (legacy lines).

import {
  Client, Events, GatewayIntentBits, Partials, type Message, type MessageReaction, type User,
} from 'discord.js';
import { accounts, loadAccounts, lineOf, type AccountConfig } from './accounts.js';
import { emitInbound, messageEnvelope, reactionEnvelope } from './format.js';
import { mintId } from './wire.js';
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

function makeClient(): Client {
  return new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMessageReactions,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.DirectMessageReactions,
      GatewayIntentBits.GuildVoiceStates,
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User],
  });
}

function onEdit(accountId: string, m: Message): void {
  if (m.author.bot) return;
  emitInbound(accountId, {
    kind: 'edit', id: mintId(), ts: new Date(m.editedTimestamp ?? Date.now()).toISOString(),
    station: 'discord', line: lineOf(accountId, m.channelId),
    from: `metro://discord/${accountId}/user/${m.author.id}`, from_name: m.author.username,
    message_id: m.id, text: m.content, is_private: m.guildId == null,
    event: { type: 'edit', targetId: m.id }, payload: m.toJSON(),
  });
}

async function bootAccount(cfg: AccountConfig): Promise<void> {
  const client = makeClient();
  const accountId = cfg.id;

  client.on(Events.MessageCreate, m => {
    const env = messageEnvelope(accountId, m);
    if (env) emitInbound(accountId, env);
  });

  client.on(Events.MessageReactionAdd, async (r, u) => {
    try {
      if (r.partial) await r.fetch();
      if (u.partial) await u.fetch();
    } catch { /* ignore partial fetch failures */ }
    const env = reactionEnvelope(accountId, r as MessageReaction, u as User);
    if (env) emitInbound(accountId, env);
  });

  client.on(Events.MessageUpdate, async (_old, _new) => {
    try { onEdit(accountId, _new.partial ? await _new.fetch() : _new as Message); }
    catch (err) {
      process.stderr.write(`discord[${accountId}] message update fetch failed: ${(err as Error).message}\n`);
    }
  });

  accounts.set(accountId, { cfg, client });
  await client.login(cfg.token);
  process.stderr.write(
    `discord[${accountId}] ready — ${client.user?.tag ?? '?'} (owner=${cfg.owner ?? '(broadcast)'})\n`);
}

const cfgs = loadAccounts();
for (const cfg of cfgs) {
  try { await bootAccount(cfg); }
  catch (err) { process.stderr.write(`discord[${cfg.id}] boot FAILED: ${(err as Error).message}\n`); }
}
if (accounts.size === 0) { process.stderr.write('discord: no accounts booted, exiting\n'); process.exit(2); }
process.stderr.write(`discord train ready — ${accounts.size} account(s): ${[...accounts.keys()].join(', ')}\n`);
