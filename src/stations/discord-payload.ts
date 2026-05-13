/** DiscordPayload type + builder. Projects a discord.js Message into a serializable shape. */

import type { Message } from 'discord.js';
import { errMsg, log } from '../log.js';

export type DiscordPayload = {
  id: string;
  channelId: string;
  guildId: string | null;
  content: string;
  timestamp: string;
  editedTimestamp: string | null;
  author: { id: string; username: string; bot: boolean };
  attachments: {
    id: string; filename: string; contentType: string | null;
    url: string; size: number; width: number | null; height: number | null;
  }[];
  mentions: {
    everyone: boolean;
    users: { id: string; username: string }[];
    roles: string[];
  };
  messageReference: { messageId: string | null; channelId: string | null; guildId: string | null } | null;
  referencedMessage: { id: string; content: string; author: { id: string; username: string } } | null;
};

export async function buildDiscordPayload(m: Message): Promise<DiscordPayload> {
  /** Reply chains: pull the referenced message inline so agents see what was replied to. */
  let referencedMessage: DiscordPayload['referencedMessage'] = null;
  if (m.reference?.messageId) {
    try {
      const ref = await m.fetchReference();
      referencedMessage = {
        id: ref.id, content: ref.content,
        author: { id: ref.author.id, username: ref.author.username },
      };
    } catch (err) { log.debug({ err: errMsg(err) }, 'discord: fetchReference failed'); }
  }
  return {
    id: m.id, channelId: m.channelId, guildId: m.guildId, content: m.content,
    timestamp: new Date(m.createdTimestamp).toISOString(),
    editedTimestamp: m.editedTimestamp ? new Date(m.editedTimestamp).toISOString() : null,
    author: { id: m.author.id, username: m.author.username, bot: m.author.bot },
    attachments: [...m.attachments.values()].map(a => ({
      id: a.id, filename: a.name, contentType: a.contentType,
      url: a.url, size: a.size, width: a.width, height: a.height,
    })),
    mentions: {
      everyone: m.mentions.everyone,
      users: [...m.mentions.users.values()].map(u => ({ id: u.id, username: u.username })),
      roles: [...m.mentions.roles.keys()],
    },
    messageReference: m.reference ? {
      messageId: m.reference.messageId ?? null,
      channelId: m.reference.channelId ?? null,
      guildId: m.reference.guildId ?? null,
    } : null,
    referencedMessage,
  };
}
