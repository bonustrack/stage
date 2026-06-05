/** Discord outbound action handler (send/reply/react/edit/delete/fetch/…). */

import { ActivityType, type Message, type PresenceStatusData } from 'discord.js';
import { accountFor, accounts, encodeEmoji, lineOf, rest, routeOf } from './accounts.js';
import { emitOutbound, emitOutboundEdit, emitOutboundReact } from './format.js';
import { respond } from './wire.js';
import { normalizeDiscord } from '../messaging-normalize.js';
import { joinVoice, leaveVoice } from './voice.js';
import { speak } from './voice-speak.js';

async function sendMessage(
  accountId: string, channel: string, body: Record<string, unknown>, files?: string[],
): Promise<{ id: string }> {
  if (!files || files.length === 0) {
    return rest<{ id: string }>(accountId, 'POST', `/channels/${channel}/messages`, body);
  }
  const form = new FormData();
  form.append('payload_json', JSON.stringify(body));
  for (let i = 0; i < files.length; i++) {
    const path = files[i];
    const data = await Bun.file(path).arrayBuffer();
    const name = path.split('/').pop() ?? `file-${i}`;
    form.append(`files[${i}]`, new Blob([data]), name);
  }
  return rest<{ id: string }>(accountId, 'POST', `/channels/${channel}/messages`, form, true);
}

export type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

const KNOWN = 'accounts, send, reply, react, edit, delete, fetch, download, '
  + 'thread_create, pin, typing, channel, set_presence, joinVoice, leaveVoice, speak';

async function send(id: string, args: Record<string, unknown>): Promise<void> {
  // sticker_ids: default/custom-guild stickers. images/files: local paths uploaded
  // as multipart (Discord 25MB total). flags=4 SUPPRESS_EMBEDS — no link preview.
  const { line, text, replyTo, embeds, stickerIds, images, files, account } = args as {
    line: string; text?: string; replyTo?: string; embeds?: unknown[];
    stickerIds?: string[]; images?: string[]; files?: string[]; account?: string;
  };
  const { accountId, channelId } = routeOf(line, account);
  const body: Record<string, unknown> = { flags: 4 };
  if (text !== undefined) body.content = text;
  if (replyTo) body.message_reference = { message_id: replyTo };
  if (embeds) body.embeds = embeds;
  if (stickerIds) body.sticker_ids = stickerIds;
  const attachments = [...(images ?? []), ...(files ?? [])];
  const res = await sendMessage(accountId, channelId, body, attachments.length ? attachments : undefined);
  emitOutbound(accountId, line, res.id, text ?? '', replyTo);
  respond(id, { result: { messageId: res.id, account: accountId } });
}

async function reply(id: string, args: Record<string, unknown>): Promise<void> {
  const { line, messageId, text, images, files, account } = args as {
    line: string; messageId: string; text: string; images?: string[]; files?: string[]; account?: string;
  };
  const { accountId, channelId } = routeOf(line, account);
  const body = { content: text, message_reference: { message_id: messageId }, flags: 4 };
  const attachments = [...(images ?? []), ...(files ?? [])];
  const res = await sendMessage(accountId, channelId, body, attachments.length ? attachments : undefined);
  emitOutbound(accountId, line, res.id, text, messageId);
  respond(id, { result: { messageId: res.id, account: accountId } });
}

async function presence(id: string, args: Record<string, unknown>): Promise<void> {
  // text: custom-status string; status: online|idle|dnd|invisible. Empty text clears
  // the activity. Optional `account` selects the bot (else sole/default).
  const { text, status = 'online', account } = args as {
    text?: string; status?: PresenceStatusData; account?: string;
  };
  const accountId = accountFor({ account });
  const client = accounts.get(accountId)!.client;
  if (!client.user) { respond(id, { error: `gateway not ready for account '${accountId}'` }); return; }
  // Discord needs the literal name "Custom Status" with the visible text in `state`;
  // passing text as `name` renders a stray "·" separator, so only set state.
  client.user.setPresence({
    status,
    activities: text ? [{ name: 'Custom Status', type: ActivityType.Custom, state: text }] : [],
  });
  respond(id, { result: { ok: true, text: text ?? null, status, account: accountId } });
}

async function dispatch({ id, action, args }: CallMsg): Promise<void> {
  if (action === 'accounts') {
    respond(id, { result: { accounts: [...accounts.values()].map(a => ({
      id: a.cfg.id, userId: a.client.user?.id ?? null, username: a.client.user?.username ?? null,
      owner: a.cfg.owner ?? null, ready: a.client.isReady(),
    })) } });
  } else if (action === 'send') {
    await send(id, args);
  } else if (action === 'reply') {
    await reply(id, args);
  } else if (action === 'react') {
    const { line, messageId, emoji, account } = args as {
      line: string; messageId: string; emoji: string; account?: string;
    };
    const { accountId, channelId } = routeOf(line, account);
    if (emoji) {
      const e = encodeEmoji(emoji);
      await rest(accountId, 'PUT', `/channels/${channelId}/messages/${messageId}/reactions/${e}/@me`);
      emitOutboundReact(accountId, line, messageId, emoji);
    } else {
      await rest(accountId, 'DELETE', `/channels/${channelId}/messages/${messageId}/reactions/@me`);
    }
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'edit') {
    const { line, messageId, text, account } = args as {
      line: string; messageId: string; text: string; account?: string;
    };
    const { accountId, channelId } = routeOf(line, account);
    await rest(accountId, 'PATCH', `/channels/${channelId}/messages/${messageId}`, { content: text });
    emitOutboundEdit(accountId, line, messageId, text);
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'delete') {
    const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
    const { accountId, channelId } = routeOf(line, account);
    await rest(accountId, 'DELETE', `/channels/${channelId}/messages/${messageId}`);
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'fetch') {
    const { line, limit = 20, before, account } = args as {
      line: string; limit?: number; before?: string; account?: string;
    };
    const { accountId, channelId } = routeOf(line, account);
    const qs = new URLSearchParams({ limit: String(limit), ...(before ? { before } : {}) });
    const msgs = await rest<Array<Message>>(accountId, 'GET', `/channels/${channelId}/messages?${qs}`);
    respond(id, { result: { messages: msgs, account: accountId } });
  } else if (action === 'download') {
    const { line, messageId, outDir = '/tmp', account } = args as {
      line: string; messageId: string; outDir?: string; account?: string;
    };
    const { accountId, channelId } = routeOf(line, account);
    const msg = await rest<{ attachments: Array<{ url: string; content_type?: string; filename: string }> }>(
      accountId, 'GET', `/channels/${channelId}/messages/${messageId}`);
    const files: Array<{ path: string; mediaType: string }> = [];
    for (const att of msg.attachments) {
      const buf = await fetch(att.url).then(r => r.arrayBuffer());
      const path = `${outDir}/${messageId}-${att.filename}`;
      await Bun.write(path, buf);
      files.push({ path, mediaType: att.content_type ?? 'application/octet-stream' });
    }
    respond(id, { result: { files, account: accountId } });
  } else if (action === 'thread_create') {
    const { line, messageId, name, autoArchiveDuration = 1440, account } = args as {
      line: string; messageId?: string; name: string; autoArchiveDuration?: number; account?: string;
    };
    const { accountId, channelId } = routeOf(line, account);
    const path = messageId
      ? `/channels/${channelId}/messages/${messageId}/threads`
      : `/channels/${channelId}/threads`;
    const res = await rest<{ id: string }>(
      accountId, 'POST', path, { name, auto_archive_duration: autoArchiveDuration });
    respond(id, { result: { threadId: res.id, line: lineOf(accountId, res.id), account: accountId } });
  } else if (action === 'pin') {
    const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
    const { accountId, channelId } = routeOf(line, account);
    await rest(accountId, 'PUT', `/channels/${channelId}/pins/${messageId}`);
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'typing') {
    const { line, account } = args as { line: string; account?: string };
    const { accountId, channelId } = routeOf(line, account);
    await rest(accountId, 'POST', `/channels/${channelId}/typing`);
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'channel') {
    const { line, account } = args as { line: string; account?: string };
    const { accountId, channelId } = routeOf(line, account);
    const res = await rest(accountId, 'GET', `/channels/${channelId}`);
    respond(id, { result: res });
  } else if (action === 'set_presence') {
    await presence(id, args);
  } else if (action === 'joinVoice') {
    await joinVoice(id, args);
  } else if (action === 'leaveVoice') {
    await leaveVoice(id, args);
  } else if (action === 'speak') {
    await speak(id, args);
  } else {
    respond(id, { error: `unknown action '${action}' (have: ${KNOWN})` });
  }
}

export async function handleCall(msg: CallMsg): Promise<void> {
  const { action, args } = normalizeDiscord(msg.action, msg.args);
  try { await dispatch({ ...msg, action, args }); }
  catch (err) { respond(msg.id, { error: (err as Error).message }); }
}
