import { describe, expect, test } from 'bun:test';
import { collectSyncReplay, type SearchStateContent } from '@stage-labs/client/xmtp/readState';
import {
  EMPTY_SEARCH_SLOT, TYPING_IDLE_MS, editSearch, receiveSearch, settleSearch, toggledLabel, typingPause, type SearchSlot,
} from '../lib/searchState.model';

const SEARCH_TYPE = 'stage.box/searchState:1.0';

const state = (query: string, at: number, labels: string[] = []): SearchStateContent => (
  { query, labels, unreadOnly: false, at }
);

const slotOf = (current: SearchStateContent): SearchSlot => ({ current, pending: null });

describe('editSearch', () => {
  test('stamps the edit with the wall clock and keeps the other fields', () => {
    const next = editSearch(slotOf(state('a', 5, ['work'])), { query: 'ab' }, 100);
    expect(next.current).toEqual(state('ab', 100, ['work']));
  });

  test('never stamps below a state it has already seen', () => {
    const behind = editSearch({ current: state('a', 50), pending: state('remote', 90) }, { query: 'ab' }, 10);
    expect(behind.current.at).toBe(91);
    expect(behind.pending).toBeNull();
  });
});

describe('receiveSearch', () => {
  test('a newer remote state replaces the local one', () => {
    expect(receiveSearch(slotOf(state('a', 5)), state('b', 6), false)).toEqual(slotOf(state('b', 6)));
  });

  test('an older or equal remote state is ignored', () => {
    const local = slotOf(state('a', 5));
    expect(receiveSearch(local, state('b', 5), false)).toBe(local);
    expect(receiveSearch(local, state('b', 4), false)).toBe(local);
  });

  test('while the user is typing, a newer remote state waits', () => {
    const held = receiveSearch(slotOf(state('typing', 5)), state('remote', 6), true);
    expect(held.current.query).toBe('typing');
    expect(held.pending?.query).toBe('remote');
    expect(receiveSearch(held, state('older', 5.5), true)).toBe(held);
  });

  test('the stored state beats the empty one on first load', () => {
    expect(receiveSearch(EMPTY_SEARCH_SLOT, state('saved', 1), false).current.query).toBe('saved');
  });
});

describe('settleSearch', () => {
  test('applies the waiting remote state once typing stops', () => {
    const held = receiveSearch(slotOf(state('typing', 5)), state('remote', 6), true);
    expect(settleSearch(held)).toEqual(slotOf(state('remote', 6)));
  });

  test('typing after a remote state arrived drops it', () => {
    const held = receiveSearch(slotOf(state('typing', 5)), state('remote', 6), true);
    const typed = editSearch(held, { query: 'typing more' }, 7);
    expect(settleSearch(typed).current.query).toBe('typing more');
  });

  test('is a no-op with nothing waiting', () => {
    const local = slotOf(state('a', 5));
    expect(settleSearch(local)).toBe(local);
  });
});

describe('typingPause', () => {
  test('counts as typing only while focused and until the idle delay after the last edit', () => {
    expect(typingPause(true, 1000, 1500)).toBe(TYPING_IDLE_MS - 500);
    expect(typingPause(true, 1000, 1000 + TYPING_IDLE_MS)).toBe(0);
    expect(typingPause(false, 1000, 1500)).toBe(0);
  });
});

describe('toggledLabel', () => {
  test('adds and removes a label by its lowercase key, kept sorted', () => {
    expect(toggledLabel(['work'], 'Home')).toEqual(['home', 'work']);
    expect(toggledLabel(['home', 'work'], 'HOME')).toEqual(['work']);
  });
});

describe('two devices through the sync group', () => {
  test('both converge on the last write, and typing is never overwritten', () => {
    const log: { contentTypeId: string; content: SearchStateContent; sentNs: number }[] = [];
    const send = (content: SearchStateContent): void => { log.push({ contentTypeId: SEARCH_TYPE, content, sentNs: log.length + 1 }); };
    const latest = (): SearchStateContent | null => collectSyncReplay(log, 0).search;

    let phone = editSearch(EMPTY_SEARCH_SLOT, { query: 'label:work', labels: ['work'] }, 100);
    send(phone.current);

    let web = EMPTY_SEARCH_SLOT;
    const fromPhone = latest();
    if (fromPhone !== null) web = receiveSearch(web, fromPhone, false);
    expect(web.current).toEqual(phone.current);

    web = editSearch(web, { query: 'label:work bob' }, 200);
    phone = receiveSearch(phone, web.current, true);
    expect(phone.current.query).toBe('label:work');
    send(web.current);
    phone = settleSearch(phone);
    expect(phone.current).toEqual(web.current);

    const phoneAgain = editSearch(phone, { query: '' }, 150);
    send(phoneAgain.current);
    web = receiveSearch(web, phoneAgain.current, false);
    expect(web.current.query).toBe('');
    expect(latest()?.query).toBe('');
  });
});
