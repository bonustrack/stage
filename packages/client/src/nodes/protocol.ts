import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import {
  A2UI_MESSAGE_VERSION,
  FRAME_ACTION_MAX_CHARS,
  FRAME_MAX_COMPONENTS,
  FRAME_MAX_MESSAGES,
  frameContentSchema,
  frameMessageSchema,
  messageComponentCount,
  nodeReplyMessageSchema,
  nodeReplyMessagesSchema,
  rendererMessageSchema,
  type FrameContent,
  type FrameMessage,
} from '../xmtp/frame.schema';
import { NODE_REPLY_MAX_BYTES } from './hosting';
import { base64url, nodeSigningText } from './signing';

const MAX_URL_CHARS = 2048;
const NODE_TIMEOUT_MS = 10_000;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.lan', '.home.arpa'];
const PRIVATE_V4: readonly (readonly [number, number, number])[] = [
  [0, 0, 255],
  [10, 0, 255],
  [127, 0, 255],
  [169, 254, 254],
  [172, 16, 31],
  [192, 168, 168],
  [100, 64, 127],
  [198, 18, 19],
];
const PRIVATE_V6 = /^(?:f[c-f]|64:ff9b:|2002:|::ffff:0:)/;
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/;
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;
const STREAM_TYPES = /\b(?:jsonl|ndjson|x-ndjson|jsonlines)\b/i;
const CAPABILITIES_HEADER = 'Stage-A2UI-Capabilities';

export type NodeUrlProblem = 'invalid' | 'insecure' | 'credentials' | 'local';

export type NodeUrl = { ok: true; url: string; host: string } | { ok: false; problem: NodeUrlProblem };

export interface NodeRequest {
  message: Record<string, unknown>;
  dataModel?: Record<string, unknown>;
}

interface NodeCallOptions {
  capabilities?: Record<string, unknown>;
  signal?: AbortSignal;
  onMessage?: (message: FrameMessage) => void;
}

export type NodeReply =
  | { kind: 'frame'; frame: FrameContent }
  | { kind: 'messages'; messages: FrameMessage[] }
  | { kind: 'streamed'; load: boolean }
  | { kind: 'unchanged' };

export type NodeProblem = 'blocked' | 'unreachable' | 'timeout' | 'status' | 'too-large' | 'invalid';

export type NodeResult = { ok: true; reply: NodeReply } | { ok: false; problem: NodeProblem; status?: number };

type ReadEnd = 'done' | 'too-large' | 'invalid';

type Push = (value: unknown) => boolean;

function v4Octets(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every((octet) => octet <= 255) ? octets : null;
}

function privateV4([a, b]: readonly number[]): boolean {
  if (a === undefined || b === undefined) return true;
  return a >= 224 || PRIVATE_V4.some(([first, low, high]) => a === first && b >= low && b <= high);
}

function mappedV4(host: string): number[] | null {
  const dotted = /^::(?:ffff:)?(\d+\.\d+\.\d+\.\d+)$/.exec(host)?.[1];
  if (dotted !== undefined) return v4Octets(dotted);
  const hex = /^::(?:ffff:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(host);
  if (hex?.[1] === undefined || hex[2] === undefined) return null;
  const high = parseInt(hex[1], 16);
  const low = parseInt(hex[2], 16);
  return [high >> 8, high & 255, low >> 8, low & 255];
}

function privateV6(host: string): boolean {
  if (host === '::' || host === '::1' || PRIVATE_V6.test(host)) return true;
  const v4 = mappedV4(host);
  return v4 !== null && privateV4(v4);
}

function isPublicHost(host: string): boolean {
  if (host.includes(':')) return !privateV6(host);
  const v4 = v4Octets(host);
  if (v4 !== null || NUMERIC_LABEL.test(host.slice(host.lastIndexOf('.') + 1))) return v4 !== null && !privateV4(v4);
  return host.includes('.') && !LOCAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

function canonicalPart(part: string): string {
  return part.replace(/%([0-9a-fA-F]{2})|[ "<>\\^`{|}[\]]/g, (match: string, hex: string | undefined) => {
    if (hex === undefined) return encodeURIComponent(match);
    const char = String.fromCharCode(parseInt(hex, 16));
    return UNRESERVED.test(char) ? char : `%${hex.toUpperCase()}`;
  });
}

function parsedUrl(raw: string): URL | null {
  if (raw === '' || raw.length > MAX_URL_CHARS) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function nodeUrlOf(raw: string): NodeUrl {
  const url = parsedUrl(raw.trim());
  if (url === null || /[^\x21-\x7e]/.test(url.host)) return { ok: false, problem: 'invalid' };
  if (url.protocol !== 'https:') return { ok: false, problem: 'insecure' };
  if (url.username !== '' || url.password !== '') return { ok: false, problem: 'credentials' };
  const host = url.hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '');
  if (!isPublicHost(host)) return { ok: false, problem: 'local' };
  const href = `https://${url.host}${canonicalPart(url.pathname)}${canonicalPart(url.search)}`;
  return href.length > MAX_URL_CHARS ? { ok: false, problem: 'invalid' } : { ok: true, url: href, host: url.host };
}

export function newNodeKey(): string {
  return bytesToHex(ed25519.utils.randomPrivateKey());
}

export function nodeKeyId(key: string): string {
  return base64url(ed25519.getPublicKey(hexToBytes(key)));
}

export function nodeHeaders(method: string, url: string, body: string, key: string, nowMs: number): Record<string, string> {
  const timestamp = String(Math.floor(nowMs / 1000));
  const signature = ed25519.sign(utf8ToBytes(nodeSigningText(method, url, timestamp, body)), hexToBytes(key));
  return { 'Stage-Key': nodeKeyId(key), 'Stage-Timestamp': timestamp, 'Stage-Signature': base64url(signature) };
}

export function nodeRequestBody(request: NodeRequest, capabilities?: Record<string, unknown>): string {
  const metadata = {
    ...(capabilities === undefined ? {} : { a2uiRendererCapabilities: capabilities }),
    ...(request.dataModel === undefined ? {} : { a2uiRendererDataModel: { version: A2UI_MESSAGE_VERSION, surfaces: request.dataModel } }),
  };
  return JSON.stringify(Object.keys(metadata).length === 0 ? request.message : { ...request.message, metadata });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function listOf(value: unknown): unknown[] | null {
  return Array.isArray(value) ? value.map((item: unknown) => item) : null;
}

function messagesOf(json: unknown): unknown[] | null {
  if (!isRecord(json)) return listOf(json);
  if (Object.keys(json).length === 0) return [];
  if (Object.keys(json).length === 1 && json.messages !== undefined) return listOf(json.messages);
  return json.version === undefined ? null : [json];
}

export function loadReplyOf(json: unknown): NodeReply | null {
  const messages = messagesOf(json);
  const parsed = messages === null ? null : frameContentSchema.safeParse({ messages });
  return parsed?.success === true ? { kind: 'frame', frame: parsed.data } : null;
}

export function messageReplyOf(json: unknown): NodeReply | null {
  const messages = json === undefined ? [] : messagesOf(json);
  if (messages === null) return null;
  if (messages.length === 0) return { kind: 'unchanged' };
  const parsed = nodeReplyMessagesSchema.safeParse(messages);
  return parsed.success ? { kind: 'messages', messages: parsed.data } : null;
}

function jsonValue(line: string): { value: unknown } | null {
  try {
    return { value: JSON.parse(line) as unknown };
  } catch {
    return null;
  }
}

function pushLines(text: string, push: Push): boolean {
  for (const line of text.split(/\r?\n/)) {
    if (line.trim() === '') continue;
    const parsed = jsonValue(line);
    if (parsed === null || !push(parsed.value)) return false;
  }
  return true;
}

function parsedJson(text: string): unknown {
  if (text.trim() === '') return undefined;
  const whole = jsonValue(text);
  if (whole !== null) return whole.value;
  const lines: unknown[] = [];
  return pushLines(text, (value) => {
    lines.push(value);
    return true;
  })
    ? lines
    : null;
}

function gateOf(schema: typeof frameMessageSchema, onMessage: (message: FrameMessage) => void): Push {
  let messages = 0;
  let components = 0;
  return (value) => {
    const parsed = schema.safeParse(value);
    if (!parsed.success) return false;
    messages += 1;
    components += messageComponentCount(parsed.data);
    if (messages > FRAME_MAX_MESSAGES || components > FRAME_MAX_COMPONENTS) return false;
    onMessage(parsed.data);
    return true;
  };
}

function chunkEnd(accepted: boolean): ReadEnd {
  return accepted ? 'done' : 'invalid';
}

async function eachChunk(body: ReadableStream<Uint8Array>, onText: (text: string) => boolean): Promise<ReadEnd> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    const end = size > NODE_REPLY_MAX_BYTES ? 'too-large' : chunkEnd(onText(decoder.decode(part.value, { stream: true })));
    if (end !== 'done') {
      void reader.cancel().catch(() => undefined);
      return end;
    }
  }
  return chunkEnd(onText(decoder.decode()));
}

async function streamLines(body: ReadableStream<Uint8Array>, push: Push): Promise<ReadEnd> {
  let pending = '';
  const end = await eachChunk(body, (chunk) => {
    pending += chunk;
    const cut = pending.lastIndexOf('\n');
    if (cut < 0) return true;
    const complete = pending.slice(0, cut);
    pending = pending.slice(cut + 1);
    return pushLines(complete, push);
  });
  return end === 'done' ? chunkEnd(pushLines(pending, push)) : end;
}

function replyMessages(reply: NodeReply): FrameMessage[] {
  if (reply.kind === 'frame') return reply.frame.messages;
  return reply.kind === 'messages' ? reply.messages : [];
}

async function pushWhole(response: Response, load: boolean, push: Push): Promise<ReadEnd> {
  let text = '';
  const read =
    response.body === null
      ? 'done'
      : await eachChunk(response.body, (chunk) => {
          text += chunk;
          return true;
        });
  if (read !== 'done') return read;
  const reply = load ? loadReplyOf(parsedJson(text)) : messageReplyOf(parsedJson(text));
  return chunkEnd(reply !== null && replyMessages(reply).every(push));
}

async function readMessages(response: Response, load: boolean, onMessage: (message: FrameMessage) => void): Promise<NodeResult> {
  if (!response.ok) return { ok: false, problem: 'status', status: response.status };
  if (Number(response.headers.get('content-length') ?? 0) > NODE_REPLY_MAX_BYTES) return { ok: false, problem: 'too-large' };
  const push = gateOf(load ? frameMessageSchema : nodeReplyMessageSchema, onMessage);
  const end =
    response.body !== null && STREAM_TYPES.test(response.headers.get('content-type') ?? '')
      ? await streamLines(response.body, push)
      : await pushWhole(response, load, push);
  return end === 'done' ? { ok: true, reply: { kind: 'streamed', load } } : { ok: false, problem: end };
}

async function collectedReply(response: Response, load: boolean): Promise<NodeResult> {
  const collected: FrameMessage[] = [];
  const result = await readMessages(response, load, (message) => {
    collected.push(message);
  });
  if (!result.ok) return result;
  const reply = load ? loadReplyOf(collected) : messageReplyOf(collected);
  return reply === null ? { ok: false, problem: 'invalid' } : { ok: true, reply };
}

async function callNode(method: 'GET' | 'POST', rawUrl: string, key: string, body: string, options: NodeCallOptions): Promise<NodeResult> {
  const node = nodeUrlOf(rawUrl);
  if (!node.ok) return { ok: false, problem: 'blocked' };
  const { capabilities, signal, onMessage } = options;
  const timeout = AbortSignal.timeout(NODE_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'application/json', ...nodeHeaders(method, node.url, body, key, Date.now()) };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  if (capabilities !== undefined) headers[CAPABILITIES_HEADER] = JSON.stringify(capabilities);
  try {
    const response = await fetch(node.url, {
      method,
      headers,
      body: method === 'POST' ? body : undefined,
      credentials: 'omit',
      redirect: 'error',
      cache: 'no-store',
      referrerPolicy: 'no-referrer',
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    const load = method === 'GET';
    return onMessage === undefined ? await collectedReply(response, load) : await readMessages(response, load, onMessage);
  } catch {
    return { ok: false, problem: timeout.aborted ? 'timeout' : 'unreachable' };
  }
}

export function loadNode(url: string, key: string, options: NodeCallOptions = {}): Promise<NodeResult> {
  return callNode('GET', url, key, '', options);
}

export function sendNodeMessage(url: string, key: string, request: NodeRequest, options: NodeCallOptions = {}): Promise<NodeResult> {
  if (!rendererMessageSchema.safeParse(request.message).success) return Promise.resolve({ ok: false, problem: 'invalid' });
  const body = nodeRequestBody(request, options.capabilities);
  if (body.length > FRAME_ACTION_MAX_CHARS) return Promise.resolve({ ok: false, problem: 'too-large' });
  return callNode('POST', url, key, body, options);
}
