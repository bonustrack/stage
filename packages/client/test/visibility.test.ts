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
import { envelopeOf } from '../src/xmtp/envelope';
import { xmtpMessage } from './fixtures/decoded-messages';

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

const MESSAGES = {
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
} satisfies Record<string, RowMessage>;

const LINE = 'stage://xmtp/c';
const enveloped = (id: string, contentTypeId: string, content: unknown): HistoryEntry =>
  envelopeOf(xmtpMessage({ id, contentTypeId, content }), LINE);

const ENTRIES: Record<string, HistoryEntry> = {
  text: enveloped('t', 'text', 'hi'),
  control: enveloped('c', 'text', CONTROL),
  reaction: enveloped('r', 'reaction', { reference: 't', content: '👍', removed: false, custom: false }),
  readReceipt: enveloped('rr', 'readReceipt', {}),
  groupUpdate: enveloped('g', 'group_updated', update),
  leftOnly: enveloped('l', 'group_updated', leftOnly),
  leave: enveloped('lr', 'leave_request', {}),
  deleteRequest: enveloped('d', 'deleteMessage', { messageId: 't' }),
  callSignal: enveloped('s', 'callSignal', {}),
  deleted: enveloped('x', 'deletedMessage', { deletedBy: 'sender' }),
  sync: enveloped('y', 'readState', {}),
  unknown: enveloped('u', 'somethingNew', { a: 1 }),
};

function table<V, T>(rows: Record<string, V>, of: (row: V) => T): Record<string, T> {
  return Object.fromEntries(Object.entries(rows).map(([key, row]) => [key, of(row)]));
}

describe('what each context shows', () => {
  test('chat list: which message can be the row preview', () => {
    expect(table(MESSAGES, (m) => [isRowCandidate(m, true), isRowCandidate(m, false)])).toEqual({
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
    expect(table(MESSAGES, (m) => [revivesRow(m, true), revivesRow(m, false)])).toEqual({
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
    expect(table(MESSAGES, countsAsUnread)).toEqual({
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
    expect(table(MESSAGES, (m) => [streamed(m, true), streamed(m, false)])).toEqual({
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
    expect(table(ENTRIES, (e) => [isSearchable(e), isShownInFeed(e), isFeedBubble(e)])).toEqual({
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
      { ...MESSAGES.text, sentNs: 500 },
      { ...MESSAGES.control, sentNs: 400 },
      { ...MESSAGES.reaction, sentNs: 300 },
      { ...MESSAGES.text, sentNs: 200, senderInboxId: 'me' },
      { ...MESSAGES.groupUpdate, sentNs: 150 },
      { ...MESSAGES.text, sentNs: 50 },
    ];
    expect(countUnreadEntries(entries, 100, 'me')).toBe(2);
  });
});
