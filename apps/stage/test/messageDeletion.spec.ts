import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { canDeleteMessage, deletedViewCache, replyQuoteOf } from '../components/conversation/messageDeletion.model';
import { bubbleMenuItems } from '../components/conversation/bubbleMenu.model';
import { mergeFeedEntries } from '../lib/feedOrder.model';

const ME = 'xmtp:me';
const PEER = 'xmtp:peer';

function entry(id: string, from: string, text?: string, extra: Partial<HistoryEntry> = {}): HistoryEntry {
  return { id, ts: '2026-09-30T00:00:00.000Z', station: 'xmtp', line: 'stage://xmtp/c', from, to: 'c', text, ...extra };
}

const mine = entry('m1', ME, 'hello', { payload: { contentType: 'text' } });
const theirs = entry('m2', PEER, 'hi', { payload: { contentType: 'text' } });
const none: ReadonlySet<string> = new Set();

describe('canDeleteMessage', () => {
  test('only my own sent messages that are not deleted yet', () => {
    expect(canDeleteMessage(mine, ME, none)).toBe(true);
    expect(canDeleteMessage(theirs, ME, none)).toBe(false);
    expect(canDeleteMessage(mine, ME, new Set(['m1']))).toBe(false);
    expect(canDeleteMessage(null, ME, none)).toBe(false);
  });

  test('never a message still sending or a channel update', () => {
    expect(canDeleteMessage(entry('tmp_1', ME, 'sending'), ME, none)).toBe(false);
    const update = entry('g1', ME, 'renamed the channel', { payload: { contentType: 'group_updated', system: true } });
    expect(canDeleteMessage(update, ME, none)).toBe(false);
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
  const answer = entry('m3', PEER, 'sure', { replyTo: 'm1' });
  const lookup = (id: string): HistoryEntry | undefined => [mine, theirs, answer].find(e => e.id === id);

  test('a reply to a deleted message quotes Message deleted', () => {
    expect(replyQuoteOf(answer, new Set(['m1']), lookup)).toBe('Message deleted');
  });

  test('a reply to a live message quotes it, a plain message has no quote', () => {
    expect(replyQuoteOf(answer, none, lookup)).toBe('hello');
    expect(replyQuoteOf(theirs, none, lookup)).toBeUndefined();
  });
});

describe('deleted row', () => {
  test('renders from a stable placeholder with no content', () => {
    const view = deletedViewCache();
    const first = view(mine);
    expect(view(mine)).toBe(first);
    expect(first.text).toBeUndefined();
    expect(first.payload).toEqual({ contentType: 'deletedMessage', deletedBy: 'sender' });
  });

  test('an SDK placeholder replaces the cached original in place', () => {
    const placeholder = entry('m1', ME, undefined, { payload: { contentType: 'deletedMessage', deletedBy: 'sender' } });
    const merged = mergeFeedEntries([theirs, mine], [placeholder]);
    expect(merged.replaced).toBe(1);
    expect(merged.added).toBe(0);
    expect(merged.entries.map(e => e.payload)).toEqual([theirs.payload, placeholder.payload]);
    expect(mergeFeedEntries(merged.entries, [mine]).entries[1]).toBe(placeholder);
  });
});
