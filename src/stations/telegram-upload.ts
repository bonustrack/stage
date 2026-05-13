/** Telegram outgoing sends — single multipart, media groups, and the rich-content dispatch. */

import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { log } from '../log.js';
import { mdToTelegramHtml } from './telegram-md.js';
import type { Button, SendOpts } from './index.js';

const API_BASE = 'https://api.telegram.org';
const NO_PREVIEW = { link_preview_options: { is_disabled: true } };

export const inlineKeyboard = (rows: Button[][]): { inline_keyboard: Button[][] } =>
  ({ inline_keyboard: rows });

async function post<T = unknown>(token: string, method: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}/bot${token}/${method}`, {
    method: 'POST', body: form, signal: AbortSignal.timeout(60_000),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown error'}`);
  return json.result as T;
}

function appendFields(form: FormData, fields: Record<string, unknown>): void {
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    form.append(k, typeof v === 'string' ? v : JSON.stringify(v));
  }
}

async function appendFile(form: FormData, field: string, filePath: string): Promise<void> {
  form.append(field, new Blob([new Uint8Array(await readFile(filePath))]), basename(filePath));
}

type TgSendApi = <T = unknown>(method: string, body: unknown) => Promise<T>;

const isParseError = (err: unknown): boolean =>
  err instanceof Error && err.message.includes("can't parse entities");

/** sendPhoto / sendDocument / sendVoice with HTML-caption + plain fallback. */
async function sendOne(
  token: string, base: Record<string, unknown>, method: string, fileField: string,
  filePath: string, caption: string,
): Promise<string> {
  const attempt = async (html: boolean): Promise<{ message_id: number }> => {
    const form = new FormData();
    appendFields(form, {
      ...base,
      caption: html ? mdToTelegramHtml(caption) : caption,
      ...(html ? { parse_mode: 'HTML' } : {}),
    });
    await appendFile(form, fileField, filePath);
    return post<{ message_id: number }>(token, method, form);
  };
  try { return String((await attempt(true)).message_id); }
  catch (err) {
    if (!isParseError(err)) throw err;
    log.warn('telegram: HTML rejected, retrying plain');
    return String((await attempt(false)).message_id);
  }
}

/** sendMediaGroup — 2-10 same-kind files. Caption goes on the first item only. */
async function sendGroup(
  token: string, base: Record<string, unknown>, kind: 'photo' | 'document',
  paths: string[], caption: string,
): Promise<string> {
  const form = new FormData();
  appendFields(form, base);
  const media = await Promise.all(paths.map(async (p, i) => {
    const field = `m${i}`;
    await appendFile(form, field, p);
    return {
      type: kind, media: `attach://${field}`,
      ...(i === 0 && caption ? { caption: mdToTelegramHtml(caption), parse_mode: 'HTML' } : {}),
    };
  }));
  form.append('media', JSON.stringify(media));
  const sent = await post<{ message_id: number }[]>(token, 'sendMediaGroup', form);
  return String(sent[0].message_id);
}

/** Plain text via sendMessage with HTML + plain fallback. */
async function sendText(send: TgSendApi, base: Record<string, unknown>, text: string): Promise<string> {
  const attempt = (html: boolean): Promise<{ message_id: number }> => send('sendMessage',
    html ? { ...base, ...NO_PREVIEW, text: mdToTelegramHtml(text), parse_mode: 'HTML' }
      : { ...base, ...NO_PREVIEW, text });
  try { return String((await attempt(true)).message_id); }
  catch (err) {
    if (!isParseError(err)) throw err;
    log.warn('telegram: HTML rejected, sending plain');
    return String((await attempt(false)).message_id);
  }
}

/** Dispatch for text + images + documents + voice + buttons. Returns the first message id. */
export async function tgSendRich(
  token: string, send: TgSendApi, base: Record<string, unknown>, text: string, opts?: SendOpts,
): Promise<string> {
  const images = opts?.images ?? [], docs = opts?.documents ?? [], voice = opts?.voice;
  const total = images.length + docs.length + (voice ? 1 : 0);
  const baseWithButtons = opts?.buttons?.length
    ? { ...base, reply_markup: inlineKeyboard(opts.buttons) } : base;

  if (total === 0) return sendText(send, baseWithButtons, text);

  if (total === 1) {
    if (voice) return sendOne(token, baseWithButtons, 'sendVoice', 'voice', voice, text);
    if (images.length) return sendOne(token, baseWithButtons, 'sendPhoto', 'photo', images[0], text);
    return sendOne(token, baseWithButtons, 'sendDocument', 'document', docs[0], text);
  }

  /* Multi-attachment: media groups don't support reply_markup — buttons are dropped. */
  if (opts?.buttons?.length) log.warn('telegram: buttons dropped on multi-attachment send');
  let first: string | undefined;
  let caption = text;
  const claim = async (id: string): Promise<void> => { first ??= id; caption = ''; };
  if (voice) await claim(await sendOne(token, base, 'sendVoice', 'voice', voice, caption));
  if (images.length === 1) await claim(await sendOne(token, base, 'sendPhoto', 'photo', images[0], caption));
  else if (images.length) await claim(await sendGroup(token, base, 'photo', images, caption));
  if (docs.length === 1) await claim(await sendOne(token, base, 'sendDocument', 'document', docs[0], caption));
  else if (docs.length) await claim(await sendGroup(token, base, 'document', docs, caption));
  return first!;
}
