import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { selectAccount } from './activeAccount';
import { mockAppStorage } from './memoryStorage';
import { settle } from './helpers';

let account = 0;
const held = new Map<string, Promise<void>>();
let failing: string | null = null;
selectAccount('listing-0');
const { values } = mockAppStorage({
  read: async (key) => {
    if (failing !== null && key.startsWith(failing)) throw new Error('storage unavailable');
    for (const [prefix, pending] of held) if (key.startsWith(prefix)) await pending;
  },
});
mock.module('../lib/xmtp.sdk', () => ({ sdk: {} }));
mock.module('../lib/xmtp.conv', () => ({ rowIdOfConv: async (id: string) => id }));
mock.module('../lib/appInFront', () => ({ isAppInFront: () => true, subscribeAppInFront: () => () => undefined }));
const { listingPrefsNow, primeListingPrefs, subscribeListingPrefs } = await import('../lib/listingPrefs');
const { accountSelectionChanged } = await import('../lib/accountSelection');
const { bumpAccountEpoch } = await import('../lib/accountEpoch');

function hold(prefix: string): () => Promise<void> {
  const { promise, resolve } = Promise.withResolvers<undefined>();
  held.set(prefix, promise);
  return async () => {
    resolve(undefined);
    held.delete(prefix);
    await settle();
  };
}

async function switchTo(id: string): Promise<void> {
  selectAccount(id);
  accountSelectionChanged();
  bumpAccountEpoch();
  await settle();
}

beforeEach(async () => {
  held.clear();
  failing = null;
  await switchTo(`listing-${++account}`);
});

describe('chat list prefs', () => {
  test('stay unsettled until the channel groups and the board order have loaded too', async () => {
    primeListingPrefs();
    await settle();
    const id = `listing-${++account}`;
    values.set(`channels.groups.${id}`, JSON.stringify({ collapsed: ['category:work'], order: ['category:work'] }));
    values.set(`board.columnOrder.${id}`, JSON.stringify(['status:done', 'status:todo']));
    const releaseGroups = hold('channels.groups.');
    const releaseBoard = hold('board.columnOrder.');
    await switchTo(id);
    expect(listingPrefsNow().settled).toBe(false);
    await releaseGroups();
    expect(listingPrefsNow().settled).toBe(false);
    await releaseBoard();
    const prefs = listingPrefsNow();
    expect(prefs.settled).toBe(true);
    expect(prefs.groups.collapsed).toEqual(['category:work']);
    expect(prefs.boardOrder).toEqual(['status:done', 'status:todo']);
  });

  test('keep one snapshot until a pref changes, and tell subscribers when one does', async () => {
    primeListingPrefs();
    await settle();
    const first = listingPrefsNow();
    expect(first.settled).toBe(true);
    expect(listingPrefsNow()).toBe(first);
    let calls = 0;
    const off = subscribeListingPrefs(() => {
      calls++;
    });
    const { setSearchQuery } = await import('../lib/searchState');
    setSearchQuery('gm');
    off();
    expect(calls).toBe(1);
    expect(listingPrefsNow()).not.toBe(first);
    expect(listingPrefsNow().search.query).toBe('gm');
  });

  test('a pref that fails to load settles with its default', async () => {
    failing = 'channels.cleared.';
    primeListingPrefs();
    await settle();
    const prefs = listingPrefsNow();
    expect(prefs.settled).toBe(true);
    expect(prefs.cleared).toEqual({});
  });

  test('a new account is unsettled again until its prefs load', async () => {
    primeListingPrefs();
    await settle();
    expect(listingPrefsNow().settled).toBe(true);
    const release = hold('home.view.');
    selectAccount(`listing-${++account}`);
    accountSelectionChanged();
    await settle();
    expect(listingPrefsNow().settled).toBe(false);
    await release();
    expect(listingPrefsNow().settled).toBe(true);
  });
});
