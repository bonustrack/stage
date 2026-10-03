import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import {
  canDeleteMessage, deleteConfirmOf, deletedViewCache, isAdminDelete, replyQuoteOf,
} from '../components/conversation/messageDeletion.model';
import { bubbleMenuItems } from '../components/conversation/bubbleMenu.model';
import { mergeFeedEntries } from '../lib/feedOrder.model';
import { entry } from './helpers';

const ME = 'xmtp:me';
const PEER = 'xmtp:peer';

const mine = entry('m1', { from: ME, text: 'hello', payload: { contentType: 'text' } });
const theirs = entry('m2', { from: PEER, text: 'hi', payload: { contentType: 'text' } });
const none: ReadonlyMap<string, 'sender' | 'admin'> = new Map();
const member = { myUri: ME, deleted: none, superAdmin: false };
const superAdmin = { myUri: ME, deleted: none, superAdmin: true };

describe('canDeleteMessage', () => {
  test('a member deletes only their own sent messages that are not deleted yet', () => {
    expect(canDeleteMessage(mine, member)).toBe(true);
    expect(canDeleteMessage(theirs, member)).toBe(false);
    expect(canDeleteMessage(mine, { ...member, deleted: new Map([['m1', 'sender']]) })).toBe(false);
    expect(canDeleteMessage(null, member)).toBe(false);
  });

  test('a channel super admin also deletes other people\'s messages', () => {
    expect(canDeleteMessage(theirs, superAdmin)).toBe(true);
    expect(canDeleteMessage(mine, superAdmin)).toBe(true);
    expect(canDeleteMessage(theirs, { ...superAdmin, deleted: new Map([['m2', 'admin']]) })).toBe(false);
  });

  test('never a message still sending or a channel update, even for a super admin', () => {
    expect(canDeleteMessage(entry('tmp_1', { from: ME, text: 'sending' }), member)).toBe(false);
    const update = entry('g1', { from: PEER, text: 'renamed the channel', payload: { contentType: 'group_updated', system: true } });
    expect(canDeleteMessage(update, superAdmin)).toBe(false);
    expect(canDeleteMessage({ ...update, from: ME }, member)).toBe(false);
  });
});

describe('delete confirm', () => {
  test('an own delete keeps the plain confirm, an admin delete says it is as a super admin', () => {
    expect(isAdminDelete(mine, ME)).toBe(false);
    expect(isAdminDelete(theirs, ME)).toBe(true);
    expect(deleteConfirmOf(false).title).toBe('Delete message?');
    expect(deleteConfirmOf(true)).toEqual({
      title: 'Delete this message for everyone?',
      message: 'You’re deleting it as a channel super admin.',
      confirmLabel: 'Delete',
      destructive: true,
    });
  });
});

describe('Delete in the message menu', () => {
  test('comes last, in red, only when allowed', () => {
    const items = bubbleMenuItems(true, { selectText: false, canDelete: true });
    expect(items.at(-1)).toEqual({ id: 'delete', icon: 'IconTrashCan', label: 'Delete', danger: true });
    expect(bubbleMenuItems(true, { selectText: false }).map(i => i.id)).not.toContain('delete');
  });
});

describe('reply quote', () => {
  const answer = entry('m3', { from: PEER, text: 'sure', replyTo: 'm1' });
  const lookup = (id: string): HistoryEntry | undefined => [mine, theirs, answer].find(e => e.id === id);

  test('a reply to a deleted message quotes who deleted it', () => {
    expect(replyQuoteOf(answer, new Map([['m1', 'sender']]), lookup)).toBe('Message deleted');
    expect(replyQuoteOf(answer, new Map([['m1', 'admin']]), lookup)).toBe('Message deleted by an admin');
  });

  test('a reply to a live message quotes it, a plain message has no quote', () => {
    expect(replyQuoteOf(answer, none, lookup)).toBe('hello');
    expect(replyQuoteOf(theirs, none, lookup)).toBeUndefined();
  });
});

describe('deleted row', () => {
  test('renders from a stable placeholder with no content', () => {
    const view = deletedViewCache();
    const first = view(mine, 'sender');
    expect(view(mine, 'sender')).toBe(first);
    expect(first.text).toBeUndefined();
    expect(first.payload).toEqual({ contentType: 'deletedMessage', deletedBy: 'sender' });
    expect(view(theirs, 'admin').payload).toEqual({ contentType: 'deletedMessage', deletedBy: 'admin' });
  });

  test('an SDK placeholder replaces the cached original in place', () => {
    const placeholder = entry('m1', { from: ME, payload: { contentType: 'deletedMessage', deletedBy: 'sender' } });
    const merged = mergeFeedEntries([theirs, mine], [placeholder]);
    expect(merged.replaced).toBe(1);
    expect(merged.added).toBe(0);
    expect(merged.entries.map(e => e.payload)).toEqual([theirs.payload, placeholder.payload]);
    expect(mergeFeedEntries(merged.entries, [mine]).entries[1]).toBe(placeholder);
  });
});
