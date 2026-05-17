/** Discord transport: discord.js gateway. Emits raw `Message.toJSON()` + reaction snapshots. */

import { Client, Events, GatewayIntentBits, Partials } from 'discord.js';
import { errMsg, log } from '../log.js';
import type { Transport, EmitFn } from './index.js';

export class DiscordTransport implements Transport {
  readonly station = 'discord';
  private client: Client | null = null;

  async start(emit: EmitFn): Promise<void> {
    const client = this.client = new Client({
      intents: [
        GatewayIntentBits.DirectMessages, GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.DirectMessageReactions,
      ],
      partials: [Partials.Channel, Partials.Message, Partials.Reaction],
    });
    client.on(Events.MessageCreate, m => { void this.onMessage(m, emit); });
    client.on(Events.MessageReactionAdd, (r, u) => { void this.onReaction(r, u, emit); });
    client.on(Events.Error, err => log.error({ err: errMsg(err) }, 'discord error'));
    await client.login(process.env.DISCORD_BOT_TOKEN);
    await new Promise<void>(r => client.once(Events.ClientReady, () => r()));
  }

  async stop(): Promise<void> {
    if (!this.client) return;
    await this.client.destroy();
    this.client = null;
  }

  /** Optional helper for the dispatcher — only used to cache bot id at startup. */
  async getMe(): Promise<{ id: string; username: string } | null> {
    const c = this.client;
    if (!c?.user) return null;
    return { id: c.user.id, username: c.user.username };
  }

  private async onMessage(m: import('discord.js').Message, emit: EmitFn): Promise<void> {
    const payload = m.toJSON() as Record<string, unknown>;
    /** Auto-fetch referenced message so reply chains are visible to adapters without a round-trip. */
    if (m.reference?.messageId) {
      try { payload.referencedMessage = (await m.fetchReference()).toJSON(); }
      catch (err) { log.debug({ err: errMsg(err) }, 'discord: fetchReference failed'); }
    }
    /** Channel name (text channels / threads) isn't on `toJSON()`; carry it through for `lineName`. */
    if (m.channel && 'name' in m.channel) {
      payload.channelName = (m.channel as { name: string | null }).name ?? null;
    }
    emit({
      station: 'discord', kind: 'message',
      ts: new Date(m.createdTimestamp).toISOString(), payload,
    });
  }

  private async onReaction(
    r: import('discord.js').MessageReaction | import('discord.js').PartialMessageReaction,
    u: import('discord.js').User | import('discord.js').PartialUser,
    emit: EmitFn,
  ): Promise<void> {
    try { if (r.partial) await r.fetch(); } catch { /* best-effort */ }
    const m = r.message;
    emit({
      station: 'discord', kind: 'reaction', ts: new Date().toISOString(),
      payload: {
        channelId: m.channelId, guildId: m.guildId, messageId: m.id,
        userId: u.id, username: 'username' in u ? u.username : undefined,
        bot: 'bot' in u ? u.bot : undefined,
        emoji: { name: r.emoji.name, id: r.emoji.id, animated: r.emoji.animated },
      },
    });
  }
}
