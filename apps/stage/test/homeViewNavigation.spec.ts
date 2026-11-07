import { beforeEach, describe, expect, mock, test } from 'bun:test';
import { homeViewNavigation } from '../components/tabs/homeViewNavigation.model';

let pathname = '/';
let view: 'chats' | 'board' = 'chats';
let loaded = false;
let epoch = 0;
const previous: { current: unknown } = { current: null };
const effects: (() => void)[] = [];
const replacements: string[] = [];
const edits: string[] = [];
const router = {
  replace: (href: string): void => {
    replacements.push(href);
  },
};

mock.module('react', () => ({
  useRef: (initial: unknown) => {
    previous.current ??= initial;
    return previous;
  },
  useEffect: (effect: () => void): void => {
    effects.push(effect);
  },
}));
mock.module('expo-router', () => ({ usePathname: () => pathname, useRouter: () => router }));
mock.module('../lib/accountEpoch', () => ({ useAccountEpoch: () => epoch }));
mock.module('../lib/homeView', () => ({
  useHomeView: () => ({ view }),
  useHomeViewLoaded: () => loaded,
  getHomeView: () => ({ view }),
  setHomeView: (edit: { view: string }): void => {
    edits.push(edit.view);
  },
}));
const { useRememberHomeView } = await import('../components/tabs/boardHome');
const render = (): void => {
  useRememberHomeView();
  for (const effect of effects.splice(0)) effect();
};

beforeEach(() => {
  pathname = '/';
  view = 'chats';
  loaded = false;
  epoch = 0;
  previous.current = null;
  edits.length = 0;
  replacements.length = 0;
});

describe('home view reload restoration', () => {
  test('waits for hydration before restoring the saved Board mode on the home page', () => {
    render();
    expect(edits).toEqual([]);
    expect(replacements).toEqual([]);
    view = 'board';
    loaded = true;
    render();
    expect(replacements).toEqual(['/board']);
    expect(edits).toEqual([]);
    render();
    expect(edits).toEqual([]);
    expect(replacements).toEqual(['/board']);
    pathname = '/board';
    render();
    expect(edits).toEqual([]);
  });

  test('a Board URL cannot overwrite stored preferences before hydration', () => {
    pathname = '/board';
    render();
    expect(edits).toEqual([]);
    view = 'board';
    loaded = true;
    render();
    expect(edits).toEqual([]);
  });

  test('Chats reloads stay Chats and an explicit later navigation can select Chats', () => {
    loaded = true;
    render();
    expect(replacements).toEqual([]);
    pathname = '/board';
    view = 'board';
    render();
    pathname = '/';
    render();
    expect(edits).toEqual(['chats']);
  });

  test('a local mode edit is not overwritten while the old route is still mounted', () => {
    loaded = true;
    render();
    view = 'board';
    render();
    expect(edits).toEqual([]);
    expect(replacements).toEqual([]);
  });

  test('account changes get a fresh restoration without touching non-home deep links', () => {
    loaded = true;
    render();
    epoch = 1;
    view = 'board';
    render();
    expect(replacements).toEqual(['/board']);
    expect(homeViewNavigation('/channel/example', 'board', null).remember).toBeNull();
    expect(homeViewNavigation('/contacts', 'board', null).restore).toBeNull();
    expect(homeViewNavigation('/board', 'chats', null).remember).toBe('board');
  });
});
