/** Telegram outbound action handler (send/react/edit/delete/media/download). */

import { accountFor, accounts, tg, tgForm, targetOf } from './telegram-accounts.js';
import { emit, mintId, respond, SELF_URI } from './telegram-wire.js';

function emitOutbound(accountId: string, line: string, messageId: string, text: string, replyTo?: string): void {
  emit({
    kind: 'outbound', id: mintId(), ts: new Date().toISOString(),
    station: 'telegram', line, from: SELF_URI, to: line, message_id: messageId, text, reply_to: replyTo,
    account: accountId, payload: { account: accountId },
  });
}

type MediaArgs = {
  line: string; path: string; caption?: string; replyTo?: string; parseMode?: string; account?: string;
};

async function sendMedia(
  method: string, fieldName: string, args: Record<string, unknown>,
): Promise<{ accountId: string; message_id: number }> {
  const { line, path, caption, replyTo, parseMode, account } = args as MediaArgs;
  const { accountId, chatId, topicId } = targetOf(line, account);
  const form = new FormData();
  form.append('chat_id', String(chatId));
  if (topicId !== undefined) form.append('message_thread_id', String(topicId));
  if (caption) form.append('caption', caption);
  if (parseMode) form.append('parse_mode', parseMode);
  if (replyTo) form.append('reply_parameters', JSON.stringify({ message_id: Number(replyTo) }));
  const data = await Bun.file(path).arrayBuffer();
  const name = path.split('/').pop() ?? fieldName;
  form.append(fieldName, new Blob([data]), name);
  const r = await tgForm<{ message_id: number }>(accountId, method, form);
  return { accountId, message_id: r.message_id };
}

export type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

/** A media send action: dispatch, emit outbound bubble, respond. */
async function media(
  id: string, method: string, field: string, label: string, args: Record<string, unknown>,
): Promise<void> {
  const { accountId, message_id } = await sendMedia(method, field, args);
  const line = (args as { line: string }).line;
  emitOutbound(accountId, line, String(message_id), label, args.replyTo as string | undefined);
  respond(id, { result: { messageId: String(message_id), account: accountId } });
}

const KNOWN = 'accounts, send, react, edit, delete, send_photo, send_document, '
  + 'send_voice, send_sticker, send_dice, send_location, download';

async function dispatch({ id, action, args }: CallMsg): Promise<void> {
  if (action === 'accounts') {
    respond(id, { result: { accounts: [...accounts.values()].map(a => ({
      id: a.cfg.id, owner: a.cfg.owner ?? null })) } });
  } else if (action === 'send') {
    const { line, text, replyTo, parseMode, buttons, account } = args as {
      line: string; text: string; replyTo?: string; parseMode?: string;
      buttons?: Array<Array<{ text: string; url: string }>>; account?: string;
    };
    const { accountId, chatId, topicId } = targetOf(line, account);
    const body: Record<string, unknown> = { chat_id: chatId, text };
    if (topicId !== undefined) body.message_thread_id = topicId;
    if (replyTo) body.reply_parameters = { message_id: Number(replyTo) };
    if (parseMode) body.parse_mode = parseMode;
    if (buttons) body.reply_markup = { inline_keyboard: buttons };
    const sent = await tg<{ message_id: number }>(accountId, 'sendMessage', body);
    emitOutbound(accountId, line, String(sent.message_id), text, replyTo);
    respond(id, { result: { messageId: String(sent.message_id), account: accountId } });
  } else if (action === 'react') {
    const { line, messageId, emoji, account } = args as {
      line: string; messageId: string; emoji: string; account?: string;
    };
    const { accountId, chatId } = targetOf(line, account);
    await tg(accountId, 'setMessageReaction', {
      chat_id: chatId, message_id: Number(messageId),
      reaction: emoji ? [{ type: 'emoji', emoji }] : [],
    });
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'edit') {
    const { line, messageId, text, parseMode, account } = args as {
      line: string; messageId: string; text: string; parseMode?: string; account?: string;
    };
    const { accountId, chatId } = targetOf(line, account);
    await tg(accountId, 'editMessageText',
      { chat_id: chatId, message_id: Number(messageId), text, parse_mode: parseMode });
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'delete') {
    const { line, messageId, account } = args as { line: string; messageId: string; account?: string };
    const { accountId, chatId } = targetOf(line, account);
    await tg(accountId, 'deleteMessage', { chat_id: chatId, message_id: Number(messageId) });
    respond(id, { result: { ok: true, account: accountId } });
  } else if (action === 'send_photo') {
    await media(id, 'sendPhoto', 'photo', (args.caption as string ?? '') + ' [image]', args);
  } else if (action === 'send_document') {
    await media(id, 'sendDocument', 'document', (args.caption as string ?? '') + ' [file]', args);
  } else if (action === 'send_voice') {
    await media(id, 'sendVoice', 'voice', '[voice]', args);
  } else if (action === 'send_sticker') {
    await media(id, 'sendSticker', 'sticker', '[sticker]', args);
  } else if (action === 'send_dice') {
    const { line, emoji = '🎲', account } = args as { line: string; emoji?: string; account?: string };
    const { accountId, chatId, topicId } = targetOf(line, account);
    const body: Record<string, unknown> = { chat_id: chatId, emoji };
    if (topicId !== undefined) body.message_thread_id = topicId;
    const r = await tg<{ message_id: number; dice?: { value: number } }>(accountId, 'sendDice', body);
    emitOutbound(accountId, line, String(r.message_id), `[dice ${emoji} = ${r.dice?.value ?? '?'}]`);
    respond(id, { result: { messageId: String(r.message_id), value: r.dice?.value, account: accountId } });
  } else if (action === 'send_location') {
    const { line, latitude, longitude, account } = args as {
      line: string; latitude: number; longitude: number; account?: string;
    };
    const { accountId, chatId } = targetOf(line, account);
    const r = await tg<{ message_id: number }>(accountId, 'sendLocation', { chat_id: chatId, latitude, longitude });
    emitOutbound(accountId, line, String(r.message_id), `[location: ${latitude}, ${longitude}]`);
    respond(id, { result: { messageId: String(r.message_id), account: accountId } });
  } else if (action === 'download') {
    // `account` selects which bot's file API (file_ids are per-bot); else sole/default.
    const { fileId, outDir = '/tmp', account } = args as { fileId: string; outDir?: string; account?: string };
    const accountId = accountFor({ account });
    const meta = await tg<{ file_path: string }>(accountId, 'getFile', { file_id: fileId });
    const data = await fetch(`${accounts.get(accountId)!.fileApi}/${meta.file_path}`).then(r => r.arrayBuffer());
    const filename = meta.file_path.split('/').pop() ?? `${fileId}.bin`;
    const path = `${outDir}/${Date.now()}-${filename}`;
    await Bun.write(path, data);
    respond(id, { result: { path, fileSize: data.byteLength, account: accountId } });
  } else {
    respond(id, { error: `unknown action '${action}' (have: ${KNOWN})` });
  }
}

export async function handleCall(msg: CallMsg): Promise<void> {
  try { await dispatch(msg); }
  catch (err) { respond(msg.id, { error: (err as Error).message }); }
}
