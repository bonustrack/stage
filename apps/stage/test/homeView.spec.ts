import { describe, expect, mock, test } from 'bun:test';
import { collectSyncReplay, DEFAULT_HOME_VIEW, type HomeViewContent } from '@stage-labs/client/xmtp/readState';
import { editHomeView, receiveHomeView, syncedHomeView } from '../lib/syncedSettings.model';
import { homeSortOf } from '../components/home/sort.model';

const values = new Map<string, string>();
let activeId = 'alice';
mock.module('../platform/storage', () => ({
  secureStorage: {},
  appStorage: {
    get: async (key: string): Promise<string | null> => values.get(key) ?? null,
    set: async (key: string, value: string): Promise<void> => { values.set(key, value); },
  },
}));
mock.module('../lib/accounts', () => ({
  getActiveAccount: async () => ({ id: activeId }),
  getActiveAccountStrict: async () => ({ id: activeId }),
}));
const { applyRemoteHomeView, loadHomeView, onHomeViewChanged, setHomeView } = await import('../lib/homeView');

const view = (v: HomeViewContent['view'], groupBy: HomeViewContent['groupBy'], at: number): HomeViewContent => (
  { view: v, groupBy, columnBy: 'label', at }
);
const settle = (): Promise<void> => new Promise(resolve => { setTimeout(resolve, 0); });
const stored = (account: string): unknown => JSON.parse(values.get(`home.view.${account}`) ?? 'null');

describe('home view model', () => {
  test('a view type pick stays local and never moves the sync clock', () => {
    expect(editHomeView(view('chats', 'none', 5), { view: 'board' }, 100)).toEqual(view('board', 'none', 5));
    expect(editHomeView(view('board', 'none', 5), { groupBy: 'label' }, 100)).toEqual(view('board', 'label', 100));
  });

  test('an incoming payload never changes the view type', () => {
    expect(receiveHomeView(view('board', 'none', 5), view('chats', 'category', 9))).toEqual(view('board', 'category', 9));
    const local = view('board', 'none', 5);
    expect(receiveHomeView(local, view('chats', 'label', 5))).toBe(local);
  });

  test('the sync payload carries the default view type, not the local one', () => {
    expect(syncedHomeView(view('board', 'label', 7))).toEqual({ ...view('board', 'label', 7), view: DEFAULT_HOME_VIEW.view });
  });
});

describe('home view sorting', () => {
  const chatsSort = { by: 'created', direction: 'asc' } as const;
  const boardSort = { by: 'status', direction: 'desc' } as const;

  test('editing either mode keeps the other preference and advances the shared clock', () => {
    const current = { ...view('board', 'label', 4), chatsSort };
    const next = editHomeView(current, { boardSort }, 10);
    expect(next).toEqual({ ...current, boardSort, at: 10 });
    expect(homeSortOf(next)).toEqual(boardSort);
    expect(homeSortOf({ ...next, view: 'chats' })).toEqual(chatsSort);
    expect(syncedHomeView(next)).toEqual({ ...next, view: 'chats' });
  });

  test('old-device sync without sort fields does not erase deliberate choices', () => {
    const current = { ...view('board', 'label', 4), chatsSort, boardSort };
    expect(receiveHomeView(current, view('chats', 'status', 9))).toEqual({ ...current, groupBy: 'status', at: 9 });
  });

  test('catch-up replay restores sorts before advancing past a legacy grouping edit', async () => {
    const log = [
      { ...view('chats', 'none', 10), chatsSort, boardSort },
      view('chats', 'category', 11),
    ].map((content, i) => ({ content, contentTypeId: 'stage.box/homeView:1.0', senderInboxId: 'self', sentNs: i + 1 }));
    const incoming = collectSyncReplay(log, 0, { inboxId: 'self', nowMs: 100 }).latest.homeView;
    expect(incoming).not.toBeNull();
    if (incoming === null) throw new Error('Missing home view replay');
    await applyRemoteHomeView('catch-up-sorts', incoming);
    expect(stored('catch-up-sorts')).toEqual({ ...view('chats', 'category', 11), chatsSort, boardSort });
  });

  test('sort choices survive serialization, reload, remote sync, and account switching', async () => {
    const state = { ...view('board', 'category', 10), columnBy: 'assignee' as const, chatsSort, boardSort };
    values.set('home.view.sorted', JSON.stringify(state));
    expect(await loadHomeView('sorted')).toEqual({ ...state, view: 'chats' });
    expect(await loadHomeView('other-unset-account')).toBeNull();
    await applyRemoteHomeView('sorted', { ...state, chatsSort: { by: 'priority', direction: 'asc' }, at: 11 });
    expect(stored('sorted')).toEqual({ ...state, chatsSort: { by: 'priority', direction: 'asc' }, at: 11 });
  });

  test('old saved grouping uses new independent sorting defaults without a migration', async () => {
    values.set('home.view.legacy-sorts', JSON.stringify(view('board', 'category', 6)));
    const state = await loadHomeView('legacy-sorts');
    expect(state).toEqual(view('chats', 'category', 6));
    expect(homeSortOf(state ?? DEFAULT_HOME_VIEW)).toEqual({ by: 'updated', direction: 'desc' });
    expect(homeSortOf({ ...(state ?? DEFAULT_HOME_VIEW), view: 'board' })).toEqual({ by: 'priority', direction: 'desc' });
  });
});

describe('home view store', () => {
  test('stored column choices survive while a missing column preference defaults to status', async () => {
    for (const columnBy of ['label', 'category', 'assignee', 'status'] as const) {
      const state = { ...view('board', 'label', 4), columnBy };
      values.set(`home.view.saved-${columnBy}`, JSON.stringify(state));
      expect(await loadHomeView(`saved-${columnBy}`)).toEqual({ ...state, view: 'chats' });
    }
    values.set('home.view.unset-column', JSON.stringify({ view: 'board', groupBy: 'category', at: 5 }));
    expect(await loadHomeView('unset-column')).toEqual({ view: 'chats', groupBy: 'category', columnBy: 'status', at: 5 });
  });

  test('the view type is saved per account, kept after a reload and never sent', async () => {
    const sent: HomeViewContent[] = [];
    const stop = onHomeViewChanged(change => { sent.push(change.state); });

    setHomeView({ view: 'board' });
    await settle();
    expect(sent).toEqual([]);
    expect(stored('alice')).toMatchObject({ view: 'board', columnBy: 'status', at: 0 });
    expect(await loadHomeView('alice')).toBeNull();

    setHomeView({ columnBy: 'category' });
    await settle();
    expect(sent.map(s => [s.view, s.columnBy])).toEqual([['chats', 'category']]);
    expect(stored('alice')).toMatchObject({ view: 'board', columnBy: 'category' });
    expect((await loadHomeView('alice'))?.view).toBe('chats');

    activeId = 'bob';
    setHomeView({ groupBy: 'label' });
    await settle();
    expect(stored('bob')).toMatchObject({ view: 'chats', groupBy: 'label' });

    activeId = 'alice';
    setHomeView({ groupBy: 'assignee' });
    await settle();
    expect(stored('alice')).toMatchObject({ view: 'board', groupBy: 'assignee', columnBy: 'category' });
    setHomeView({ boardSort: { by: 'created', direction: 'asc' } });
    await settle();
    expect(stored('alice')).toMatchObject({ view: 'board', boardSort: { by: 'created', direction: 'asc' } });
    expect(sent.at(-1)).toMatchObject({ view: 'chats', boardSort: { by: 'created', direction: 'asc' } });
    expect(stored('bob')).not.toHaveProperty('boardSort');
    stop();
  });

  test('a remote payload keeps the local view type of each account', async () => {
    setHomeView({ view: 'board' });
    await settle();
    await applyRemoteHomeView('alice', view('chats', 'category', Date.now() + 60_000));
    expect(stored('alice')).toMatchObject({ view: 'board', groupBy: 'category' });

    values.set('home.view.carol', JSON.stringify(view('board', 'none', 0)));
    await applyRemoteHomeView('carol', view('chats', 'label', 3));
    expect(stored('carol')).toEqual(view('board', 'label', 3));
  });
});
