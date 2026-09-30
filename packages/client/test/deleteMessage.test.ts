import { describe, expect, test } from 'bun:test';
import {
  DELETE_MESSAGE_CODEC, DELETED_MESSAGE_TEXT, decodeDeleteMessageBytes, encodeDeleteMessage, encodeDeleteMessageBytes,
  isDeleteRequestType, isDeletedPlaceholderType,
} from '../src/xmtp/deleteMessage';
import { envelopeFromContent, mapDecodedToEnvelope } from '../src/xmtp/envelope';
import { previewOfXmtpContent } from '../src/xmtp/humanize';
import { countUnreadEntries } from '../src/xmtp/summarizeRow';
import type { HistoryEntry } from '../src/types';

const MESSAGE_ID = 'c2c22efb7a1d9b0e4f2c1a3b5d6e7f8091a2b3c4d5e6f708192a3b4c5d6e7f80';

const base: HistoryEntry = {
  id: 'm1', ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from: 'xmtp:alice', to: 'c',
};

describe('XIP-76 delete message codec', () => {
  test('encodes the message id as protobuf field 1, like the probe that worked on the dev network', () => {
    const utf8 = [...new TextEncoder().encode(MESSAGE_ID)];
    expect([...encodeDeleteMessageBytes(MESSAGE_ID)]).toEqual([0x0a, utf8.length, ...utf8]);
  });

  test('round-trips a message id, also one longer than a single length byte', () => {
    expect(decodeDeleteMessageBytes(encodeDeleteMessageBytes(MESSAGE_ID))).toEqual({ messageId: MESSAGE_ID });
    const long = MESSAGE_ID.repeat(3);
    const bytes = encodeDeleteMessageBytes(long);
    expect([...bytes.subarray(0, 3)]).toEqual([0x0a, 0xc0, 0x01]);
    expect(decodeDeleteMessageBytes(bytes).messageId).toBe(long);
  });

  test('skips fields it does not know', () => {
    const id = encodeDeleteMessageBytes(MESSAGE_ID);
    const extra = new Uint8Array([0x10, 0x96, 0x01, 0x1d, 1, 2, 3, 4, ...id, 0x22, 0x02, 0x68, 0x69]);
    expect(decodeDeleteMessageBytes(extra).messageId).toBe(MESSAGE_ID);
  });

  test('rejects empty, truncated and unsupported payloads', () => {
    expect(() => decodeDeleteMessageBytes(new Uint8Array([]))).toThrow('missing message id');
    expect(() => decodeDeleteMessageBytes(new Uint8Array([0x0a, 0x05, 0x61]))).toThrow('truncated');
    expect(() => decodeDeleteMessageBytes(new Uint8Array([0x0b]))).toThrow('unsupported wire type');
  });

  test('builds encoded content with the xmtp.org/deleteMessage:1.0 type and no push', () => {
    const encoded = encodeDeleteMessage(MESSAGE_ID);
    expect(encoded.type).toEqual({ authorityId: 'xmtp.org', typeId: 'deleteMessage', versionMajor: 1, versionMinor: 0 });
    expect(encoded.parameters).toEqual({});
    expect(DELETE_MESSAGE_CODEC.decode(DELETE_MESSAGE_CODEC.encode({ messageId: MESSAGE_ID }))).toEqual({ messageId: MESSAGE_ID });
    expect(DELETE_MESSAGE_CODEC.shouldPush()).toBe(false);
    expect(DELETE_MESSAGE_CODEC.fallback()).toBeUndefined();
  });

  test('recognises short and full content type ids', () => {
    expect(isDeleteRequestType('xmtp.org/deleteMessage:1.0')).toBe(true);
    expect(isDeleteRequestType('deleteMessage')).toBe(true);
    expect(isDeleteRequestType('deletedMessage')).toBe(false);
    expect(isDeletedPlaceholderType('xmtp.org/deletedMessage:1.0')).toBe(true);
    expect(isDeletedPlaceholderType(undefined)).toBe(false);
  });
});

describe('delete entries in the feed', () => {
  test('a native delete request becomes a hidden request that points at its target', () => {
    const e = mapDecodedToEnvelope({
      id: 'd1', senderInboxId: 'alice', sentNs: 1, contentTypeId: 'xmtp.org/deleteMessage:1.0',
      content: () => ({ messageId: 'm1' }),
    }, 'stage://xmtp/c');
    expect(e.payload).toEqual({ contentType: 'deleteMessage', deletes: 'm1' });
    expect(e.text).toBeUndefined();
  });

  test('a web placeholder keeps who deleted it, number or string', () => {
    expect(envelopeFromContent(base, 'deletedMessage', { deletedBy: 0 }, undefined).payload)
      .toEqual({ contentType: 'deletedMessage', deletedBy: 'sender' });
    expect(envelopeFromContent(base, 'deletedMessage', { deletedBy: 'Sender' }, undefined).payload)
      .toEqual({ contentType: 'deletedMessage', deletedBy: 'sender' });
    expect(envelopeFromContent(base, 'deletedMessage', { deletedBy: 1, adminInboxId: 'x' }, undefined).payload)
      .toEqual({ contentType: 'deletedMessage', deletedBy: 'admin' });
    expect(envelopeFromContent(base, 'deletedMessage', { deletedBy: 'Admin' }, undefined).payload)
      .toEqual({ contentType: 'deletedMessage', deletedBy: 'admin' });
    expect(envelopeFromContent(base, 'deletedMessage', {}, undefined).payload)
      .toEqual({ contentType: 'deletedMessage', deletedBy: 'sender' });
  });

  test('chat list preview reads Message deleted, or by an admin', () => {
    expect(previewOfXmtpContent({ deletedBy: 0 }, 'deletedMessage')).toBe(DELETED_MESSAGE_TEXT);
    expect(previewOfXmtpContent({ deletedBy: 1, adminInboxId: 'x' }, 'deletedMessage')).toBe('Message deleted by an admin');
    expect(previewOfXmtpContent({ messageId: 'm1' }, 'xmtp.org/deleteMessage:1.0')).toBe(DELETED_MESSAGE_TEXT);
  });

  test('a delete request is never counted as unread', () => {
    const entries = [
      { sentNs: 300, senderInboxId: 'other', contentTypeId: 'xmtp.org/deleteMessage:1.0' },
      { sentNs: 200, senderInboxId: 'other', contentTypeId: 'text' },
    ];
    expect(countUnreadEntries(entries, 0, 'me')).toBe(1);
  });
});
