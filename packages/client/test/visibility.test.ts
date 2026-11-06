import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '../src/types';
import {
  arrivalEffect,
  countsAsUnread,
  isFeedBubble,
  isRowCandidate,
  isSearchable,
  isShownInFeed,
  revivesRow,
  type ShownMessage,
} from '../src/xmtp/visibility';
import { countUnreadEntries } from '../src/xmtp/summarizeRow';
import { entry } from './helpers';

const CONTROL = 'METRO_CTRL:ping';

type RowMessage = ShownMessage & { senderInboxId: string; sentNs: number };

type StreamOutcome = 'drop' | 'refresh' | 'unchanged' | 'unread' | 'read' | 'unread, no revival';

function streamed(m: RowMessage, dm: boolean): StreamOutcome {
  const effect = arrivalEffect(m);
  if (effect !== 'row') return effect;
  if (!isRowCandidate(m, dm)) return 'unchanged';
  const unread = countsAsUnread(m);
  if (!revivesRow(m, dm)) return unread ? 'unread, no revival' : 'read';
  return unread ? 'unread' : 'read';
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
    expect(table(MESSAGES, (k) => [isRowCandidate(message(k), true), isRowCandidate(message(k), false)])).toEqual({
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
      leave: [false, true],
      deleteMessage: [false, false],
      deleteRequest: [false, false],
      deleted: [true, true],
      sync: [false, false],
      unknown: [true, true],
    });
  });

  test('chat list: which message brings a deleted chat back', () => {
    expect(table(MESSAGES, (k) => [revivesRow(message(k), true), revivesRow(message(k), false)])).toEqual({
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
      leave: [false, true],
      deleteMessage: [false, false],
      deleteRequest: [false, false],
      deleted: [true, true],
      sync: [false, false],
      unknown: [true, true],
    });
  });

  test('unread: which message from someone else counts', () => {
    expect(table(MESSAGES, (k) => countsAsUnread(message(k)))).toEqual({
      text: true,
      control: false,
      reply: true,
      reaction: true,
      readReceipt: true,
      attachment: true,
      poll: true,
      frame: true,
      callInvite: true,
      callSignal: false,
      groupUpdate: false,
      leave: false,
      deleteMessage: false,
      deleteRequest: false,
      deleted: true,
      sync: false,
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
      leave: ['unchanged', 'read'],
      deleteMessage: ['refresh', 'refresh'],
      deleteRequest: ['refresh', 'refresh'],
      deleted: ['unread', 'unread'],
      sync: ['drop', 'drop'],
      unknown: ['unread', 'unread'],
    });
  });

  test('search, feed cache and feed bubbles: which entry each one keeps', () => {
    expect(table(ENTRIES, (k) => [isSearchable(historyEntry(k)), isShownInFeed(historyEntry(k)), isFeedBubble(historyEntry(k))])).toEqual({
      text: [true, true, true],
      control: [false, false, true],
      reaction: [true, true, false],
      readReceipt: [true, true, false],
      groupUpdate: [true, true, true],
      leftOnly: [true, true, false],
      leave: [true, true, true],
      deleteRequest: [false, true, false],
      callSignal: [false, true, false],
      deleted: [false, true, true],
      sync: [false, true, false],
      unknown: [true, true, true],
    });
  });

  test('a full content type id classifies like its short id', () => {
    const at = (contentTypeId: string): RowMessage => ({ contentTypeId, content: {}, senderInboxId: 'peer', sentNs: 1 });
    expect(isRowCandidate(at('xmtp.org/group_updated:1.0'), true)).toBe(false);
    expect(countsAsUnread(at('xmtp.org/group_updated:1.0'))).toBe(false);
    expect(revivesRow(at('xmtp.org/reaction:1.0'), false)).toBe(false);
    expect(isRowCandidate(at('xmtp.org/deleteMessage:1.0'), false)).toBe(false);
    expect(isRowCandidate(at('stage.box/callSignal:1.0'), false)).toBe(false);
  });

  test('the unread count skips my own messages and what does not count', () => {
    const entries = [
      { ...message('text'), sentNs: 500 },
      { ...message('control'), sentNs: 400 },
      { ...message('reaction'), sentNs: 300 },
      { ...message('text'), sentNs: 200, senderInboxId: 'me' },
      { ...message('groupUpdate'), sentNs: 150 },
      { ...message('text'), sentNs: 50 },
    ];
    expect(countUnreadEntries(entries, 100, 'me')).toBe(2);
  });
});
