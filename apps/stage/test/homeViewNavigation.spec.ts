import { describe, expect, test } from 'bun:test';
import { homeViewNavigation, type HomeViewNavigationState } from '../components/tabs/homeViewNavigation.model';

const initial = (epoch = 0): HomeViewNavigationState => ({ epoch, pathname: null, restoringFrom: null });

describe('hydrated home view navigation', () => {
  test('a cold home visit restores saved Board without remembering Chats', () => {
    const next = homeViewNavigation('/', 'board', initial(), 0);
    expect(next.restore).toBe('/board');
    expect(next.remember).toBeNull();
    expect(homeViewNavigation('/', 'board', next.state, 0)).toEqual({ state: next.state, restore: null, remember: null });
    const restored = homeViewNavigation('/board', 'board', next.state, 0);
    expect(restored.restore).toBeNull();
    expect(restored.remember).toBeNull();
  });

  test('Chats reload stays Chats and an explicit Board URL selects Board', () => {
    expect(homeViewNavigation('/', 'chats', initial(), 0).restore).toBeNull();
    expect(homeViewNavigation('/', 'chats', initial(), 0).remember).toBeNull();
    expect(homeViewNavigation('/board', 'chats', initial(), 0).remember).toBe('board');
  });

  test('local preference publication cannot overwrite an edit while the old route is mounted', () => {
    const current = homeViewNavigation('/', 'chats', initial(), 0).state;
    const next = homeViewNavigation('/', 'board', current, 0);
    expect(next.remember).toBeNull();
    expect(next.restore).toBeNull();
  });

  test('both directions remember route intent even when storage still contains the target mode', () => {
    const board = homeViewNavigation('/board', 'board', initial(), 0).state;
    const chats = homeViewNavigation('/', 'board', board, 0);
    expect(chats.remember).toBe('chats');
    expect(homeViewNavigation('/board', 'board', chats.state, 0).remember).toBe('board');
    const saved = homeViewNavigation('/board', 'chats', chats.state, 0).state;
    expect(homeViewNavigation('/board', 'chats', saved, 0).remember).toBeNull();
  });

  test('switching from another account on Board restores the new account Chats choice', () => {
    const previous = homeViewNavigation('/board', 'board', initial(), 0).state;
    const next = homeViewNavigation('/board', 'chats', previous, 1);
    expect(next.restore).toBe('/');
    expect(next.remember).toBeNull();
    expect(homeViewNavigation('/board', 'chats', next.state, 1).remember).toBeNull();
    expect(homeViewNavigation('/', 'chats', next.state, 1).restore).toBeNull();
  });

  test('switching from Chats restores a new account Board choice', () => {
    const previous = homeViewNavigation('/', 'chats', initial(), 0).state;
    const next = homeViewNavigation('/', 'board', previous, 1);
    expect(next.restore).toBe('/board');
    expect(next.remember).toBeNull();
  });

  test('non-home deep links do not change mode, including after an account switch', () => {
    for (const path of ['/channel/example', '/contacts', '/wallet', '/settings']) {
      const next = homeViewNavigation(path, 'board', initial(), 1);
      expect(next.restore).toBeNull();
      expect(next.remember).toBeNull();
    }
  });
});
