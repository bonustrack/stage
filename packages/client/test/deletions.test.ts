import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '../src/types';
import {
  deletedEntryView, deletedMessageIds, isDeletableEntry, isDeleteRequest, isDeletedRowMessage,
} from '../src/xmtp/deletions';
import type { StreamedMessage } from '../src/xmtp/summarizeRow';

const ALICE = 'xmtp:alice';
const BOB = 'xmtp:bob';

function entry(id: string, from: string, payload?: Record<string, unknown>, text?: string): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from, to: 'c', text, payload };
}

const hello = entry('m1', ALICE, { contentType: 'text' }, 'hello');
const reply = { ...entry('m2', BOB, { contentType: 'reply', replyTo: 'm1' }, 'hi back'), replyTo: 'm1' };
const request = (id: string, from: string, target: string): HistoryEntry =>
  entry(id, from, { contentType: 'deleteMessage', deletes: target });

describe('deletedMessageIds', () => {
  test('a delete from the original sender deletes the message', () => {
    expect([...deletedMessageIds([request('d1', ALICE, 'm1'), reply, hello])]).toEqual(['m1']);
  });

  test('a delete from anyone else is ignored', () => {
    expect(deletedMessageIds([request('d1', BOB, 'm1'), hello]).size).toBe(0);
  });

  test('group updates cannot be deleted', () => {
    const update = entry('g1', ALICE, { contentType: 'group_updated', system: true }, 'renamed the channel');
    expect(deletedMessageIds([request('d1', ALICE, 'g1'), update]).size).toBe(0);
  });

  test('waits until the target is loaded, whatever the order', () => {
    const del = request('d1', ALICE, 'm1');
    expect(deletedMessageIds([del]).size).toBe(0);
    expect(deletedMessageIds([hello, del]).has('m1')).toBe(true);
  });

  test('an SDK placeholder and a local delete both count', () => {
    const placeholder = entry('m3', BOB, { contentType: 'deletedMessage', deletedBy: 'sender' });
    const ids = deletedMessageIds([placeholder, hello, reply], new Set(['m2']));
    expect([...ids].sort()).toEqual(['m2', 'm3']);
  });

  test('requests and placeholders are not deletable bubbles themselves', () => {
    expect(isDeleteRequest(request('d1', ALICE, 'm1'))).toBe(true);
    expect(isDeletableEntry(request('d1', ALICE, 'm1'))).toBe(false);
    expect(isDeletableEntry(entry('m3', BOB, { contentType: 'deletedMessage' }))).toBe(false);
    expect(isDeletableEntry(hello)).toBe(true);
  });
});

describe('deletedEntryView', () => {
  test('keeps the position and sender but drops every piece of content', () => {
    const withMedia = { ...reply, payload: { contentType: 'reply', replyTo: 'm1', attachments: [{ kind: 'image' }] } };
    expect(deletedEntryView(withMedia)).toEqual({
      id: 'm2', ts: reply.ts, station: 'xmtp', line: reply.line, from: BOB, to: 'c', messageId: undefined,
      payload: { contentType: 'deletedMessage', deletedBy: 'sender' },
    });
  });
});

describe('isDeletedRowMessage', () => {
  const row = (id: string, sender: string, contentTypeId: string, content: unknown): StreamedMessage =>
    ({ id, senderInboxId: sender, contentTypeId, content, sentNs: 1 });
  const last = row('m1', 'alice', 'xmtp.org/text:1.0', 'hello');

  test('native: a delete request from the same sender in the recent messages', () => {
    const del = row('d1', 'alice', 'xmtp.org/deleteMessage:1.0', { messageId: 'm1' });
    expect(isDeletedRowMessage(last, [del, last])).toBe(true);
  });

  test('ignores a delete request from someone else', () => {
    const del = row('d1', 'bob', 'xmtp.org/deleteMessage:1.0', { messageId: 'm1' });
    expect(isDeletedRowMessage(last, [del, last])).toBe(false);
  });

  test('web: the SDK placeholder, and this device\'s own delete', () => {
    expect(isDeletedRowMessage(row('m1', 'alice', 'deletedMessage', { deletedBy: 0 }), [])).toBe(true);
    expect(isDeletedRowMessage(last, [last], new Set(['m1']))).toBe(true);
    expect(isDeletedRowMessage(last, [last])).toBe(false);
  });
});
