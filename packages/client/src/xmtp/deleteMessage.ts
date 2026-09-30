import { z } from 'zod';
import type { XmtpContentTypeId } from './codecs';

export const DELETE_MESSAGE_CONTENT_TYPE: XmtpContentTypeId = {
  authorityId: 'xmtp.org', typeId: 'deleteMessage', versionMajor: 1, versionMinor: 0,
};

export const DELETE_MESSAGE_TYPE_ID = DELETE_MESSAGE_CONTENT_TYPE.typeId;

export const DELETED_MESSAGE_TYPE_ID = 'deletedMessage';

export const DELETED_MESSAGE_TEXT = 'Message deleted';

export type DeletedBy = 'sender' | 'admin';

const deleteMessageSchema = z.object({ messageId: z.string().min(1) });

export type DeleteMessageContent = z.infer<typeof deleteMessageSchema>;

export interface EncodedDeleteMessage {
  type: XmtpContentTypeId;
  parameters: Record<string, string>;
  content: Uint8Array;
}

const MESSAGE_ID_TAG = 0x0a;
const WIRE_VARINT = 0;
const WIRE_FIXED64 = 1;
const WIRE_LENGTH = 2;
const WIRE_FIXED32 = 5;

function varint(value: number): number[] {
  const out: number[] = [];
  let rest = value;
  while (rest > 0x7f) {
    out.push((rest & 0x7f) | 0x80);
    rest = Math.floor(rest / 0x80);
  }
  out.push(rest);
  return out;
}

export function encodeDeleteMessageBytes(messageId: string): Uint8Array {
  const id = new TextEncoder().encode(messageId);
  return new Uint8Array([MESSAGE_ID_TAG, ...varint(id.length), ...id]);
}

interface Cursor { bytes: Uint8Array; at: number }

function readVarint(c: Cursor): number {
  let value = 0;
  let scale = 1;
  for (let i = 0; i < 8; i += 1) {
    const byte = c.bytes[c.at];
    if (byte === undefined) throw new Error('deleteMessage: truncated varint');
    c.at += 1;
    value += (byte & 0x7f) * scale;
    if ((byte & 0x80) === 0) return value;
    scale *= 0x80;
  }
  throw new Error('deleteMessage: varint too long');
}

function skip(c: Cursor, count: number): void {
  if (c.at + count > c.bytes.length) throw new Error('deleteMessage: truncated field');
  c.at += count;
}

function readField(c: Cursor, wire: number): Uint8Array | null {
  if (wire === WIRE_LENGTH) {
    const length = readVarint(c);
    const start = c.at;
    skip(c, length);
    return c.bytes.subarray(start, start + length);
  }
  if (wire === WIRE_VARINT) readVarint(c);
  else if (wire === WIRE_FIXED64) skip(c, 8);
  else if (wire === WIRE_FIXED32) skip(c, 4);
  else throw new Error(`deleteMessage: unsupported wire type ${wire}`);
  return null;
}

export function decodeDeleteMessageBytes(bytes: Uint8Array): DeleteMessageContent {
  const c: Cursor = { bytes, at: 0 };
  let messageId = '';
  while (c.at < bytes.length) {
    const key = readVarint(c);
    const value = readField(c, key % 8);
    if (Math.floor(key / 8) === 1 && value !== null) messageId = new TextDecoder().decode(value);
  }
  if (!messageId) throw new Error('deleteMessage: missing message id');
  return { messageId };
}

export function encodeDeleteMessage(messageId: string): EncodedDeleteMessage {
  return { type: DELETE_MESSAGE_CONTENT_TYPE, parameters: {}, content: encodeDeleteMessageBytes(messageId) };
}

export const DELETE_MESSAGE_CODEC = {
  contentType: DELETE_MESSAGE_CONTENT_TYPE,
  encode: (content: DeleteMessageContent): EncodedDeleteMessage => encodeDeleteMessage(content.messageId),
  decode: (encoded: { content: Uint8Array }): DeleteMessageContent => decodeDeleteMessageBytes(encoded.content),
  fallback: (): undefined => undefined,
  shouldPush: (): boolean => false,
};

export function shortTypeId(contentTypeId: string | undefined | null): string {
  if (!contentTypeId) return '';
  return contentTypeId.split('/').pop()?.split(':')[0] ?? contentTypeId;
}

export function isDeleteRequestType(contentTypeId: string | undefined | null): boolean {
  return shortTypeId(contentTypeId) === DELETE_MESSAGE_TYPE_ID;
}

export function isDeletedPlaceholderType(contentTypeId: string | undefined | null): boolean {
  return shortTypeId(contentTypeId) === DELETED_MESSAGE_TYPE_ID;
}

export function deleteTargetOfContent(content: unknown): string | undefined {
  const parsed = deleteMessageSchema.safeParse(content);
  return parsed.success ? parsed.data.messageId : undefined;
}

const SENDER_VALUES: readonly unknown[] = [0, 'Sender', 'sender'];

export function deletedByOfContent(content: unknown): DeletedBy {
  const by = (content as { deletedBy?: unknown } | null | undefined)?.deletedBy;
  return SENDER_VALUES.includes(by) ? 'sender' : 'admin';
}
