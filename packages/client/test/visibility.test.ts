import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '../src/types';
import { isDeleteRequestType } from '../src/xmtp/deleteMessage';
import { isCallSignalEntry, isCallSignalType } from '../src/xmtp/call';
import { isDeleteRequest } from '../src/xmtp/deletions';
import { isGroupUpdateTypeId, onlyMembersLeft, type GroupUpdatedContent } from '../src/xmtp/humanize';
import { revivesClearedChat } from '../src/xmtp/sync/clear';
import type { RowMessage } from '../src/xmtp/summarizeRow';
import { entry } from './helpers';

const CONTROL = 'METRO_CTRL:ping';

const isControlBody = (text: unknown): boolean => typeof text === 'string' && text.startsWith('METRO_CTRL:');

function rowCandidate(m: RowMessage, dm: boolean): boolean {
  return (
    !(typeof m.content === 'string' && isControlBody(m.content)) &&
    !(dm && isGroupUpdateTypeId(m.contentTypeId)) &&
    !isDeleteRequestType(m.contentTypeId) &&
    !isCallSignalType(m.contentTypeId)
  );
}

function revives(m: RowMessage, dm: boolean): boolean {
  return rowCandidate(m, dm) && revivesClearedChat(m.contentTypeId);
}

function countsUnread(m: RowMessage): boolean {
  return !isGroupUpdateTypeId(m.contentTypeId) && !isDeleteRequestType(m.contentTypeId) && !isCallSignalType(m.contentTypeId);
}

type StreamOutcome = 'drop' | 'refresh' | 'unchanged' | 'unread' | 'read' | 'unread, no revival';

function streamed(m: RowMessage, dm: boolean): StreamOutcome {
  if (isCallSignalType(m.contentTypeId)) return 'drop';
  if (isDeleteRequestType(m.contentTypeId)) return 'refresh';
  if (typeof m.content === 'string' && isControlBody(m.content)) return 'drop';
  if (dm && isGroupUpdateTypeId(m.contentTypeId)) return 'unchanged';
  const unread = !isGroupUpdateTypeId(m.contentTypeId);
  if (!revivesClearedChat(m.contentTypeId)) return unread ? 'unread, no revival' : 'read';
  return unread ? 'unread' : 'read';
}

function searchable(e: HistoryEntry): boolean {
  return !!e.text && !isControlBody(e.text) && !isCallSignalEntry(e) && !isDeleteRequest(e);
}

function inFeedCache(e: HistoryEntry): boolean {
  return !isControlBody(e.text);
}

function feedBubble(e: HistoryEntry): boolean {
  const p = e.payload as { reactTo?: string; system?: boolean; groupUpdate?: GroupUpdatedContent } | undefined;
  const leftOnly = p?.system === true && p.groupUpdate !== undefined && onlyMembersLeft(p.groupUpdate);
  return !p?.reactTo && !leftOnly && !isDeleteRequest(e) && !isCallSignalEntry(e);
}

const update = { initiatedByInboxId: 'x', addedInboxes: [{ inboxId: 'y' }], removedInboxes: [], metadataFieldChanges: [] };
const leftOnly = { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], leftInboxes: [{ inboxId: 'y' }] };

const MESSAGES: Record<string, RowMessage> = {
  text: { contentTypeId: 'text', content: 'hi', senderInboxId: 'peer', sentNs: 1 },
  control: { contentTypeId: 'text', content: CONTROL, senderInboxId: 'peer', sentNs: 1 },
  reply: { contentTypeId: 'reply', content: { reference: 'm0', text: 'yes' }, senderInboxId: 'peer', sentNs: 1 },
  reaction: { contentTypeId: 'reaction', content: { reference: 'm0', content: '👍' }, senderInboxId: 'peer', sentNs: 1 },
  readReceipt: { contentTypeId: 'readReceipt', content: {}, senderInboxId: 'peer', sentNs: 1 },
  attachment: { contentTypeId: 'multiRemoteStaticAttachment', content: { attachments: [] }, senderInboxId: 'peer', sentNs: 1 },
  poll: { contentTypeId: 'poll', content: { question: 'Q' }, senderInboxId: 'peer', sentNs: 1 },
  frame: { contentTypeId: 'frame', content: { messages: [] }, senderInboxId: 'peer', sentNs: 1 },
  callInvite: { contentTypeId: 'callInvite', content: {}, senderInboxId: 'peer', sentNs: 1 },
  callSignal: { contentTypeId: 'callSignal', content: {}, senderInboxId: 'peer', sentNs: 1 },
  groupUpdate: { contentTypeId: 'group_updated', content: update, senderInboxId: 'peer', sentNs: 1 },
  leave: { contentTypeId: 'leave_request', content: {}, senderInboxId: 'peer', sentNs: 1 },
  deleteMessage: { contentTypeId: 'deleteMessage', content: { messageId: 'm0' }, senderInboxId: 'peer', sentNs: 1 },
  deleteRequest: { contentTypeId: 'deleteRequest', content: { messageId: 'm0' }, senderInboxId: 'peer', sentNs: 1 },
  deleted: { contentTypeId: 'deletedMessage', content: { deletedBy: 'sender' }, senderInboxId: 'peer', sentNs: 1 },
  sync: { contentTypeId: 'readState', content: {}, senderInboxId: 'peer', sentNs: 1 },
  unknown: { contentTypeId: 'somethingNew', content: { a: 1 }, senderInboxId: 'peer', sentNs: 1 },
};

const ENTRIES: Record<string, HistoryEntry> = {
  text: entry('t', { text: 'hi', payload: { contentType: 'text' } }),
  control: entry('c', { text: CONTROL, payload: { contentType: 'text' } }),
  reaction: entry('r', { text: '[react 👍]', payload: { contentType: 'reaction', reactTo: 't', emoji: '👍', removed: false } }),
  readReceipt: entry('rr', { text: '[readReceipt payload]', payload: { contentType: 'readReceipt' } }),
  groupUpdate: entry('g', { text: 'added 1 member', payload: { contentType: 'group_updated', system: true, groupUpdate: update } }),
  leftOnly: entry('l', {
    text: '1 member left the channel',
    payload: { contentType: 'group_updated', system: true, groupUpdate: leftOnly },
  }),
  leave: entry('lr', { text: 'left the channel', payload: { contentType: 'leave_request', system: true } }),
  deleteRequest: entry('d', { payload: { contentType: 'deleteMessage', deletes: 't' } }),
  callSignal: entry('s', { text: '[callSignal payload]', payload: { contentType: 'callSignal' } }),
  deleted: entry('x', { payload: { contentType: 'deletedMessage', deletedBy: 'sender' } }),
  sync: entry('y', { text: 'Stage read state', payload: { contentType: 'readState' } }),
  unknown: entry('u', { text: '[somethingNew payload]', payload: { contentType: 'somethingNew' } }),
};

function table<T>(rows: Record<string, unknown>, of: (key: string) => T): Record<string, T> {
  return Object.fromEntries(Object.keys(rows).map((key) => [key, of(key)]));
}

function message(key: string): RowMessage {
  const m = MESSAGES[key];
  if (m === undefined) throw new Error(key);
  return m;
}

function historyEntry(key: string): HistoryEntry {
  const e = ENTRIES[key];
  if (e === undefined) throw new Error(key);
  return e;
}

describe('what each context shows', () => {
  test('chat list: which message can be the row preview', () => {
    expect(table(MESSAGES, (k) => [rowCandidate(message(k), true), rowCandidate(message(k), false)])).toEqual({
      text: [true, true],
      control: [false, false],
      reply: [true, true],
      reaction: [true, true],
      readReceipt: [true, true],
      attachment: [true, true],
      poll: [true, true],
      frame: [true, true],
      callInvite: [true, true],
      callSignal: [false, false],
      groupUpdate: [false, true],
      leave: [true, true],
      deleteMessage: [false, false],
      deleteRequest: [false, false],
      deleted: [true, true],
      sync: [true, true],
      unknown: [true, true],
    });
  });

  test('chat list: which message brings a deleted chat back', () => {
    expect(table(MESSAGES, (k) => [revives(message(k), true), revives(message(k), false)])).toEqual({
      text: [true, true],
      control: [false, false],
      reply: [true, true],
      reaction: [false, false],
      readReceipt: [false, false],
      attachment: [true, true],
      poll: [true, true],
      frame: [true, true],
      callInvite: [true, true],
      callSignal: [false, false],
      groupUpdate: [false, true],
      leave: [true, true],
      deleteMessage: [false, false],
      deleteRequest: [false, false],
      deleted: [true, true],
      sync: [true, true],
      unknown: [true, true],
    });
  });

  test('unread: which message from someone else counts', () => {
    expect(table(MESSAGES, (k) => countsUnread(message(k)))).toEqual({
      text: true,
      control: true,
      reply: true,
      reaction: true,
      readReceipt: true,
      attachment: true,
      poll: true,
      frame: true,
      callInvite: true,
      callSignal: false,
      groupUpdate: false,
      leave: true,
      deleteMessage: false,
      deleteRequest: false,
      deleted: true,
      sync: true,
      unknown: true,
    });
  });

  test('stream and notification: what an arriving message does to its row', () => {
    expect(table(MESSAGES, (k) => [streamed(message(k), true), streamed(message(k), false)])).toEqual({
      text: ['unread', 'unread'],
      control: ['drop', 'drop'],
      reply: ['unread', 'unread'],
      reaction: ['unread, no revival', 'unread, no revival'],
      readReceipt: ['unread, no revival', 'unread, no revival'],
      attachment: ['unread', 'unread'],
      poll: ['unread', 'unread'],
      frame: ['unread', 'unread'],
      callInvite: ['unread', 'unread'],
      callSignal: ['drop', 'drop'],
      groupUpdate: ['unchanged', 'read'],
      leave: ['unread', 'unread'],
      deleteMessage: ['refresh', 'refresh'],
      deleteRequest: ['refresh', 'refresh'],
      deleted: ['unread', 'unread'],
      sync: ['unread', 'unread'],
      unknown: ['unread', 'unread'],
    });
  });

  test('search, feed cache and feed bubbles: which entry each one keeps', () => {
    expect(table(ENTRIES, (k) => [searchable(historyEntry(k)), inFeedCache(historyEntry(k)), feedBubble(historyEntry(k))])).toEqual({
      text: [true, true, true],
      control: [false, false, true],
      reaction: [true, true, false],
      readReceipt: [true, true, true],
      groupUpdate: [true, true, true],
      leftOnly: [true, true, false],
      leave: [true, true, true],
      deleteRequest: [false, true, false],
      callSignal: [false, true, false],
      deleted: [false, true, true],
      sync: [true, true, true],
      unknown: [true, true, true],
    });
  });

  test('native content type ids miss the group update and silent rules today', () => {
    const native = (typeId: string, content: unknown): RowMessage => ({ contentTypeId: typeId, content, senderInboxId: 'peer', sentNs: 1 });
    expect(rowCandidate(native('xmtp.org/group_updated:1.0', update), true)).toBe(true);
    expect(countsUnread(native('xmtp.org/group_updated:1.0', update))).toBe(true);
    expect(revives(native('xmtp.org/reaction:1.0', {}), false)).toBe(true);
    expect(rowCandidate(native('xmtp.org/deleteMessage:1.0', {}), false)).toBe(false);
    expect(rowCandidate(native('stage.box/callSignal:1.0', {}), false)).toBe(false);
  });
});
