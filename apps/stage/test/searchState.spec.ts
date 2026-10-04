import { describe, expect, test } from 'bun:test';
import { collectSyncReplay, type SearchStateContent } from '@stage-labs/client/xmtp/readState';
import {
  EMPTY_SEARCH, editFilters, receiveSearch, restoreSearch, syncedSearch, toggledLabel,
} from '../lib/syncedSettings.model';

const SEARCH_TYPE = 'stage.box/searchState:1.0';
const OWN_INBOX = 'inbox-me';
const MINE = { inboxId: OWN_INBOX, nowMs: 1_000 };

const state = (query: string, at: number, labels: string[] = []): SearchStateContent => (
  { query, labels, unreadOnly: false, at }
);

describe('editFilters', () => {
  test('stamps the edit with the wall clock and keeps the search text', () => {
    expect(editFilters(state('bob', 5), { labels: ['work'] }, 100)).toEqual(state('bob', 100, ['work']));
  });

  test('never stamps below the state it has already seen', () => {
    expect(editFilters(state('', 50), { unreadOnly: true }, 10).at).toBe(51);
  });
});

describe('receiveSearch', () => {
  test('a newer remote state replaces the filters and keeps the local search text', () => {
    expect(receiveSearch(state('mine', 5), state('theirs', 6, ['work']))).toEqual(state('mine', 6, ['work']));
  });

  test('an older or equal remote state is ignored', () => {
    const local = state('a', 5, ['home']);
    expect(receiveSearch(local, state('b', 5, ['work']))).toBe(local);
    expect(receiveSearch(local, state('b', 4, ['work']))).toBe(local);
  });
});

describe('restoreSearch', () => {
  test('the saved search text and filters come back after a reload', () => {
    expect(restoreSearch(EMPTY_SEARCH, state('saved', 3, ['work']))).toEqual(state('saved', 3, ['work']));
    expect(restoreSearch(EMPTY_SEARCH, state('typed only', 0))).toEqual(state('typed only', 0));
  });

  test('text typed before the load finished is kept', () => {
    expect(restoreSearch(state('new', 0), state('saved', 3, ['work']))).toEqual(state('new', 3, ['work']));
  });
});

describe('syncedSearch', () => {
  test('the sync payload carries the filters but never the search text', () => {
    expect(syncedSearch(state('secret', 7, ['work']))).toEqual(state('', 7, ['work']));
  });
});

describe('toggledLabel', () => {
  test('adds and removes a label by its lowercase key, kept sorted', () => {
    expect(toggledLabel(['work'], 'Home')).toEqual(['home', 'work']);
    expect(toggledLabel(['home', 'work'], 'HOME')).toEqual(['work']);
  });
});

describe('two devices through the sync group', () => {
  test('filters converge, the search text stays on each device', () => {
    const log: { contentTypeId: string; content: SearchStateContent; senderInboxId: string; sentNs: number }[] = [];
    const send = (content: SearchStateContent): void => {
      log.push({ contentTypeId: SEARCH_TYPE, content, senderInboxId: OWN_INBOX, sentNs: log.length + 1 });
    };
    const latest = (): SearchStateContent | null => collectSyncReplay(log, 0, MINE).latest.search;

    let phone = editFilters({ ...EMPTY_SEARCH, query: 'bob' }, { labels: ['work'] }, 100);
    send(syncedSearch(phone));
    expect(latest()?.query).toBe('');

    let web = { ...EMPTY_SEARCH, query: 'alice' };
    const fromPhone = latest();
    if (fromPhone !== null) web = receiveSearch(web, fromPhone);
    expect(web).toEqual(state('alice', 100, ['work']));

    web = editFilters(web, { unreadOnly: true }, 200);
    send(syncedSearch(web));
    const fromWeb = latest();
    if (fromWeb !== null) phone = receiveSearch(phone, fromWeb);
    expect(phone).toEqual({ query: 'bob', labels: ['work'], unreadOnly: true, at: 200 });
  });

  test('search text sent by an older version is ignored', () => {
    const log = [{ contentTypeId: SEARCH_TYPE, content: state('from old app', 300, ['home']), senderInboxId: OWN_INBOX, sentNs: 1 }];
    const incoming = collectSyncReplay(log, 0, MINE).latest.search;
    expect(incoming).not.toBeNull();
    if (incoming === null) return;
    expect(receiveSearch(state('mine', 100), incoming)).toEqual(state('mine', 300, ['home']));
    expect(receiveSearch(EMPTY_SEARCH, incoming).query).toBe('');
  });
});
