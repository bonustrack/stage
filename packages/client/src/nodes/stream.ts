import { FRAME_MAX_COMPONENTS, FRAME_MAX_MESSAGES, messageComponentCount, type FrameMessage } from '../xmtp/frame.schema';
import { NODE_REPLY_MAX_BYTES } from './hosting';

const STREAM_TYPES = /\b(?:jsonl|ndjson|x-ndjson|jsonlines)\b/i;

export type StreamEnd = 'done' | 'too-large' | 'invalid';

interface MessageSchema { safeParse: (value: unknown) => { success: true; data: FrameMessage } | { success: false } }

export interface MessageGate {
  push: (value: unknown) => boolean;
  count: () => number;
}

export function isStreamedReply(contentType: string | null): boolean {
  return contentType !== null && STREAM_TYPES.test(contentType);
}

export function createMessageGate(schema: MessageSchema, onMessage: (message: FrameMessage) => void): MessageGate {
  let messages = 0;
  let components = 0;
  return {
    push: (value) => {
      const parsed = schema.safeParse(value);
      if (!parsed.success) return false;
      messages += 1;
      components += messageComponentCount(parsed.data);
      if (messages > FRAME_MAX_MESSAGES || components > FRAME_MAX_COMPONENTS) return false;
      onMessage(parsed.data);
      return true;
    },
    count: () => messages,
  };
}

function parsedLine(line: string): { ok: true; value: unknown } | { ok: false } {
  try {
    return { ok: true, value: JSON.parse(line) as unknown };
  } catch {
    return { ok: false };
  }
}

function pushLines(text: string, gate: MessageGate): boolean {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const parsed = parsedLine(line);
    if (!parsed.ok || !gate.push(parsed.value)) return false;
  }
  return true;
}

export async function streamLines(body: ReadableStream<Uint8Array>, gate: MessageGate): Promise<StreamEnd> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let pending = '';
  let size = 0;
  const stop = (end: StreamEnd): StreamEnd => {
    void reader.cancel().catch(() => undefined);
    return end;
  };
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > NODE_REPLY_MAX_BYTES) return stop('too-large');
    pending += decoder.decode(part.value, { stream: true });
    const cut = pending.lastIndexOf('\n');
    if (cut < 0) continue;
    const complete = pending.slice(0, cut);
    pending = pending.slice(cut + 1);
    if (!pushLines(complete, gate)) return stop('invalid');
  }
  return pushLines(pending + decoder.decode(), gate) ? 'done' : 'invalid';
}
