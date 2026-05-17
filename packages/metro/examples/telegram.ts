/**
 * Telegram train. Long-polls the Bot API, projects each inbound message to a metro envelope.
 * Reads action calls on stdin: send, edit, react.
 *
 * Setup:
 *   cp <this-file> ~/.metro/trains/telegram.ts
 *   echo 'TELEGRAM_BOT_TOKEN=your-token' >> ~/.metro/.env
 *
 * No npm deps required — uses native fetch.
 */

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) { process.stderr.write('TELEGRAM_BOT_TOKEN unset\n'); process.exit(2); }

const API = `https://api.telegram.org/bot${TOKEN}`;

function emit(event: unknown): void { process.stdout.write(JSON.stringify(event) + '\n'); }
function respond(id: string, body: { result?: unknown; error?: string }): void {
  process.stdout.write(JSON.stringify({ op: 'response', id, ...body }) + '\n');
}

const mintId = (): string => `msg_${Math.random().toString(36).slice(2, 10)}`;

async function tg<T>(method: string, body: unknown, timeoutMs = 30_000): Promise<T> {
  const res = await fetch(`${API}/${method}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(timeoutMs),
  });
  const json = (await res.json()) as { ok: boolean; description?: string; result?: T };
  if (!json.ok) throw new Error(`telegram ${method}: ${json.description ?? 'unknown'}`);
  return json.result as T;
}

type TgMsg = {
  message_id: number; date: number;
  chat: { id: number; type: string; title?: string; first_name?: string };
  from?: { id: number; username?: string; first_name?: string; is_bot?: boolean };
  text?: string; caption?: string;
  message_thread_id?: number; is_topic_message?: boolean;
  photo?: unknown[]; document?: { file_name?: string };
};

function envelope(m: TgMsg): Record<string, unknown> {
  const tags: string[] = [];
  if (m.photo?.length) tags.push('[image]');
  if (m.document) tags.push(`[file: ${m.document.file_name ?? 'doc'}]`);
  const text = [m.text ?? m.caption, ...tags].filter(Boolean).join(' ');
  const topicId = m.is_topic_message ? m.message_thread_id : undefined;
  const line = topicId !== undefined
    ? `metro://telegram/${m.chat.id}/${topicId}`
    : `metro://telegram/${m.chat.id}`;
  const fromName = m.from?.username ? `@${m.from.username}` : m.from?.first_name;
  return {
    kind: 'inbound', id: mintId(),
    ts: new Date(m.date * 1000).toISOString(),
    station: 'telegram', line,
    lineName: topicId === undefined ? (m.chat.title ?? m.chat.first_name ?? undefined) : undefined,
    from: `metro://telegram/user/${m.from?.id ?? 'unknown'}`,
    fromName, messageId: String(m.message_id),
    text, payload: m, isPrivate: m.chat.type === 'private',
  };
}

let offset = 0;
async function pollLoop(): Promise<void> {
  while (true) {
    try {
      const updates = await tg<{ update_id: number; message?: TgMsg }[]>('getUpdates',
        { offset, timeout: 25, allowed_updates: ['message'] }, 60_000);
      for (const u of updates) {
        offset = u.update_id + 1;
        if (u.message && !u.message.from?.is_bot) emit(envelope(u.message));
      }
    } catch (err) {
      process.stderr.write(`telegram poll error: ${(err as Error).message}\n`);
      await new Promise(r => setTimeout(r, 2_000));
    }
  }
}

const targetOf = (line: string): { chatId: number; topicId?: number } => {
  const m = line.match(/^metro:\/\/telegram\/(-?\d+)(?:\/(\d+))?/);
  if (!m) throw new Error(`bad telegram line: ${line}`);
  return { chatId: Number(m[1]), topicId: m[2] ? Number(m[2]) : undefined };
};

type CallMsg = { op: 'call'; id: string; action: string; args: Record<string, unknown> };

async function handleCall(call: CallMsg): Promise<void> {
  const { id, action, args } = call;
  try {
    if (action === 'send') {
      const { line, text, replyTo } = args as { line: string; text: string; replyTo?: string };
      const { chatId, topicId } = targetOf(line);
      const body: Record<string, unknown> = { chat_id: chatId, text };
      if (topicId !== undefined) body.message_thread_id = topicId;
      if (replyTo) body.reply_parameters = { message_id: Number(replyTo) };
      const sent = await tg<{ message_id: number }>('sendMessage', body);
      respond(id, { result: { messageId: String(sent.message_id) } });
    } else if (action === 'edit') {
      const { line, messageId, text } = args as { line: string; messageId: string; text: string };
      await tg('editMessageText', { chat_id: targetOf(line).chatId, message_id: Number(messageId), text });
      respond(id, { result: { ok: true } });
    } else if (action === 'react') {
      const { line, messageId, emoji } = args as { line: string; messageId: string; emoji: string };
      await tg('setMessageReaction', {
        chat_id: targetOf(line).chatId, message_id: Number(messageId),
        reaction: emoji ? [{ type: 'emoji', emoji }] : [],
      });
      respond(id, { result: { ok: true } });
    } else {
      respond(id, { error: `unknown action '${action}' (have: send, edit, react)` });
    }
  } catch (err) {
    respond(id, { error: (err as Error).message });
  }
}

let buf = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', chunk => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.op === 'call') void handleCall(msg);
    } catch (err) {
      process.stderr.write(`bad stdin line: ${(err as Error).message}\n`);
    }
  }
});

process.stderr.write('telegram train ready\n');
await pollLoop();
