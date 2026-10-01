import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '../src/types';
import {
  deletedEntryView, deletedMessages, deletedRowBy, isDeletableEntry, isDeleteRequest,
} from '../src/xmtp/deletions';
import { XMTP_USER_PREFIX } from '../src/xmtp/line';
import type { StreamedMessage } from '../src/xmtp/summarizeRow';

const ALICE = `${XMTP_USER_PREFIX}alice`;
const BOB = `${XMTP_USER_PREFIX}bob`;
const OWNER = `${XMTP_USER_PREFIX}owner`;
const MOD = `${XMTP_USER_PREFIX}mod`;
const SUPER_ADMINS: ReadonlySet<string> = new Set(['owner']);

function entry(id: string, from: string, payload?: Record<string, unknown>, text?: string): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from, to: 'c', text, payload };
}

const hello = entry('m1', ALICE, { contentType: 'text' }, 'hello');
const reply = { ...entry('m2', BOB, { contentType: 'reply', replyTo: 'm1' }, 'hi back'), replyTo: 'm1' };
const request = (id: string, from: string, target: string): HistoryEntry =>
  entry(id, from, { contentType: 'deleteMessage', deletes: target });

describe('deletedMessages', () => {
  test('a delete from the original sender deletes the message', () => {
    expect([...deletedMessages([request('d1', ALICE, 'm1'), reply, hello])]).toEqual([['m1', 'sender']]);
  });

  test('a delete from anyone else is ignored', () => {
    expect(deletedMessages([request('d1', BOB, 'm1'), hello]).size).toBe(0);
  });

  test('a channel super admin may delete anyone\'s message', () => {
    const deleted = deletedMessages([request('d1', OWNER, 'm1'), hello], { superAdmins: SUPER_ADMINS });
    expect([...deleted]).toEqual([['m1', 'admin']]);
  });

  test('a plain admin, a member or a stranger is refused', () => {
    for (const from of [MOD, BOB, `${XMTP_USER_PREFIX}stranger`, 'owner']) {
      expect(deletedMessages([request('d1', from, 'm1'), hello], { superAdmins: SUPER_ADMINS }).size).toBe(0);
    }
  });

  test('super admin rights come only from the list, never from a DM', () => {
    expect(deletedMessages([request('d1', OWNER, 'm1'), hello]).size).toBe(0);
  });

  test('the sender\'s own delete wins over an admin delete', () => {
    const both = [request('d2', OWNER, 'm1'), request('d1', ALICE, 'm1'), hello];
    expect(deletedMessages(both, { superAdmins: SUPER_ADMINS }).get('m1')).toBe('sender');
  });

  test('group updates cannot be deleted, not even by a super admin', () => {
    const update = entry('g1', ALICE, { contentType: 'group_updated', system: true }, 'renamed the channel');
    expect(deletedMessages([request('d1', ALICE, 'g1'), update]).size).toBe(0);
    expect(deletedMessages([request('d1', OWNER, 'g1'), update], { superAdmins: SUPER_ADMINS }).size).toBe(0);
  });

  test('waits until the target is loaded, whatever the order', () => {
    const del = request('d1', ALICE, 'm1');
    expect(deletedMessages([del]).size).toBe(0);
    expect(deletedMessages([hello, del]).has('m1')).toBe(true);
  });

  test('an SDK placeholder and a local delete both count, with who deleted them', () => {
    const placeholder = entry('m3', BOB, { contentType: 'deletedMessage', deletedBy: 'admin' });
    const deleted = deletedMessages([placeholder, hello, reply], { ownDeletes: new Set(['m1', 'm2']), selfInboxId: 'alice' });
    expect(Object.fromEntries(deleted)).toEqual({ m1: 'sender', m2: 'admin', m3: 'admin' });
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
    expect(deletedEntryView(withMedia, 'admin').payload).toEqual({ contentType: 'deletedMessage', deletedBy: 'admin' });
  });
});

describe('deletedRowBy', () => {
  const row = (id: string, sender: string, contentTypeId: string, content: unknown): StreamedMessage =>
    ({ id, senderInboxId: sender, contentTypeId, content, sentNs: 1 });
  const last = row('m1', 'alice', 'xmtp.org/text:1.0', 'hello');
  const deleteBy = (sender: string, target = 'm1'): StreamedMessage =>
    row('d1', sender, 'xmtp.org/deleteMessage:1.0', { messageId: target });

  test('native: a delete request from the same sender in the recent messages', () => {
    expect(deletedRowBy(last, [deleteBy('alice'), last])).toBe('sender');
  });

  test('native: a delete request from a super admin, not from a plain admin', () => {
    expect(deletedRowBy(last, [deleteBy('owner'), last], { superAdmins: SUPER_ADMINS })).toBe('admin');
    expect(deletedRowBy(last, [deleteBy('mod'), last], { superAdmins: SUPER_ADMINS })).toBeNull();
  });

  test('a channel update or a leave request is never shown as deleted', () => {
    const update = row('g1', 'alice', 'xmtp.org/group_updated:1.0', {});
    expect(deletedRowBy(update, [deleteBy('alice', 'g1'), update])).toBeNull();
    expect(deletedRowBy(update, [deleteBy('owner', 'g1'), update], { superAdmins: SUPER_ADMINS })).toBeNull();
    const leave = row('g1', 'alice', 'xmtp.org/leave_request:1.0', {});
    expect(deletedRowBy(leave, [deleteBy('owner', 'g1'), leave], { superAdmins: SUPER_ADMINS })).toBeNull();
  });

  test('ignores a delete request from someone else', () => {
    expect(deletedRowBy(last, [deleteBy('bob'), last])).toBeNull();
  });

  test('a Stage delete request hides a frame action, from its sender or a super admin only', () => {
    const tap = row('m1', 'alice', 'stage.box/frameAction:1.0', { frameId: 'f1', action: { type: 'subscribe' } });
    const stageDelete = (sender: string): StreamedMessage =>
      row('d1', sender, 'stage.box/deleteRequest:1.0', { messageId: 'm1' });
    expect(deletedRowBy(tap, [stageDelete('alice'), tap])).toBe('sender');
    expect(deletedRowBy(tap, [stageDelete('owner'), tap], { superAdmins: SUPER_ADMINS })).toBe('admin');
    expect(deletedRowBy(tap, [stageDelete('bob'), tap])).toBeNull();
  });

  test('web: the SDK placeholder, and this device\'s own delete', () => {
    expect(deletedRowBy(row('m1', 'alice', 'deletedMessage', { deletedBy: 0 }), [])).toBe('sender');
    expect(deletedRowBy(row('m1', 'alice', 'deletedMessage', { deletedBy: 1, adminInboxId: 'owner' }), [])).toBe('admin');
    expect(deletedRowBy(last, [last], { ownDeletes: new Set(['m1']), selfInboxId: 'alice' })).toBe('sender');
    expect(deletedRowBy(last, [last], { ownDeletes: new Set(['m1']), selfInboxId: 'owner' })).toBe('admin');
    expect(deletedRowBy(last, [last])).toBeNull();
  });
});
