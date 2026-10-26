import { ed25519 } from '@noble/curves/ed25519';
import { bytesToHex, concatBytes, hexToBytes, utf8ToBytes } from '@noble/hashes/utils';
import {
  A2UI_MESSAGE_VERSION, FRAME_ACTION_MAX_CHARS, frameContentSchema, nodeReplyMessagesSchema, rendererMessageSchema,
  type FrameContent, type FrameMessage,
} from '../xmtp/frame.schema';
import { NODE_REPLY_MAX_BYTES } from './hosting';
import { base64url, nodeSigningText } from './signing';

const MAX_URL_CHARS = 2048;
const NODE_TIMEOUT_MS = 10_000;
const LOCAL_SUFFIXES = ['.localhost', '.local', '.localdomain', '.internal', '.lan', '.home.arpa'];
const PRIVATE_V4: readonly (readonly [number, number, number])[] = [
  [0, 0, 255], [10, 0, 255], [127, 0, 255], [169, 254, 254], [172, 16, 31], [192, 168, 168], [100, 64, 127], [198, 18, 19],
];
const PRIVATE_V6 = /^(?:f[c-f]|64:ff9b:|2002:|::ffff:0:)/;
const NUMERIC_LABEL = /^(?:\d+|0x[0-9a-f]*)$/;
const UNRESERVED = /^[A-Za-z0-9\-._~]$/;

export const NODE_CAPABILITIES_HEADER = 'Stage-A2UI-Capabilities';

export type NodeUrlProblem = 'invalid' | 'insecure' | 'credentials' | 'local';

export type NodeUrl = { ok: true; url: string; host: string } | { ok: false; problem: NodeUrlProblem };

export interface NodeRequest { message: Record<string, unknown>; dataModel?: Record<string, unknown> }

export interface NodeCallOptions { capabilities?: Record<string, unknown>; signal?: AbortSignal }

export type NodeReply = { kind: 'frame'; frame: FrameContent } | { kind: 'messages'; messages: FrameMessage[] } | { kind: 'unchanged' };

export type NodeProblem = 'blocked' | 'unreachable' | 'timeout' | 'status' | 'too-large' | 'invalid';

export type NodeResult = { ok: true; reply: NodeReply } | { ok: false; problem: NodeProblem; status?: number };

type NodeMethod = 'GET' | 'POST';

const UNCHANGED: NodeReply = { kind: 'unchanged' };

function v4Octets(host: string): number[] | null {
  const parts = host.split('.');
  if (parts.length !== 4 || parts.some(part => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  return octets.every(octet => octet <= 255) ? octets : null;
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
  return host.includes('.') && !LOCAL_SUFFIXES.some(suffix => host.endsWith(suffix));
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
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
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
  if (messages.length === 0) return UNCHANGED;
  const parsed = nodeReplyMessagesSchema.safeParse(messages);
  return parsed.success ? { kind: 'messages', messages: parsed.data } : null;
}

function parsedLines(text: string): unknown {
  try {
    return text.split(/\r?\n/).filter(line => line.trim() !== '').map(line => JSON.parse(line) as unknown);
  } catch {
    return null;
  }
}

function parsedJson(text: string): unknown {
  if (text.trim() === '') return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return parsedLines(text);
  }
}

async function cappedText(response: Response): Promise<string | null> {
  const reader = response.body?.getReader();
  if (reader === undefined) {
    const text = await response.text();
    return text.length > NODE_REPLY_MAX_BYTES ? null : text;
  }
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    size += part.value.byteLength;
    if (size > NODE_REPLY_MAX_BYTES) {
      void reader.cancel().catch(() => undefined);
      return null;
    }
    chunks.push(part.value);
  }
  return new TextDecoder().decode(concatBytes(...chunks));
}

async function readReply(response: Response, replyOf: (json: unknown) => NodeReply | null): Promise<NodeResult> {
  if (!response.ok) return { ok: false, problem: 'status', status: response.status };
  if (Number(response.headers.get('content-length') ?? 0) > NODE_REPLY_MAX_BYTES) return { ok: false, problem: 'too-large' };
  const text = await cappedText(response);
  if (text === null) return { ok: false, problem: 'too-large' };
  const reply = replyOf(parsedJson(text));
  return reply === null ? { ok: false, problem: 'invalid' } : { ok: true, reply };
}

async function callNode(method: NodeMethod, rawUrl: string, key: string, body: string, options: NodeCallOptions): Promise<NodeResult> {
  const node = nodeUrlOf(rawUrl);
  if (!node.ok) return { ok: false, problem: 'blocked' };
  const { capabilities, signal } = options;
  const timeout = AbortSignal.timeout(NODE_TIMEOUT_MS);
  const headers: Record<string, string> = { Accept: 'application/json', ...nodeHeaders(method, node.url, body, key, Date.now()) };
  if (method === 'POST') headers['Content-Type'] = 'application/json';
  if (capabilities !== undefined) headers[NODE_CAPABILITIES_HEADER] = JSON.stringify(capabilities);
  try {
    const response = await fetch(node.url, {
      method, headers, body: method === 'POST' ? body : undefined,
      credentials: 'omit', redirect: 'error', cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: signal === undefined ? timeout : AbortSignal.any([signal, timeout]),
    });
    return await readReply(response, method === 'GET' ? loadReplyOf : messageReplyOf);
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
