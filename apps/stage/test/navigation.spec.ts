import { describe, expect, test } from 'bun:test';
import { TabRouter, type TabNavigationState } from 'expo-router/build/react-navigation/routers/TabRouter';
import type { CommonNavigationAction, ParamListBase } from 'expo-router/build/react-navigation/routers/types';
import { WEB_TAB_BACK_BEHAVIOR } from '../lib/navigation.model';

const options = {
  routeNames: ['index', 'wallet', 'settings', 'board'],
  routeParamList: {},
  routeGetIdList: {},
};
const router = TabRouter({ backBehavior: WEB_TAB_BACK_BEHAVIOR });
type State = TabNavigationState<ParamListBase>;

function apply(state: State, action: CommonNavigationAction): State {
  const next = router.getStateForAction(state, action, options);
  if (next === null) throw new Error(`Unhandled navigation action: ${action.type}`);
  return next;
}

function visit(state: State, name: string, params?: object): State {
  return apply(state, { type: 'NAVIGATE', payload: { name, params } });
}

function historyNames(state: State): (string | undefined)[] {
  return state.history.map(item => state.routes.find(route => route.key === item.key)?.name);
}

function currentName(state: State): string | undefined {
  return state.routes[state.index]?.name;
}

describe('web tab history', () => {
  test('every tab visit adds a history entry instead of replacing the previous page', () => {
    let state = router.getInitialState(options);
    for (const name of ['wallet', 'settings', 'board']) state = visit(state, name);
    expect(historyNames(state)).toEqual(['index', 'wallet', 'settings', 'board']);
    for (const name of ['settings', 'wallet', 'index']) {
      state = apply(state, { type: 'GO_BACK' });
      expect(currentName(state)).toBe(name);
    }
    expect(router.getStateForAction(state, { type: 'GO_BACK' }, options)).toBeNull();
  });

  test('returning to a visited tab keeps earlier visits in browser order', () => {
    let state = router.getInitialState(options);
    for (const name of ['wallet', 'settings', 'wallet', 'index', 'board']) state = visit(state, name);
    expect(historyNames(state)).toEqual(['index', 'wallet', 'settings', 'wallet', 'index', 'board']);
    for (const name of ['index', 'wallet', 'settings', 'wallet', 'index']) {
      state = apply(state, { type: 'GO_BACK' });
      expect(currentName(state)).toBe(name);
    }
  });

  test('selecting the current tab does not add a duplicate entry', () => {
    let state = visit(router.getInitialState(options), 'wallet');
    state = visit(state, 'wallet');
    expect(historyNames(state)).toEqual(['index', 'wallet']);
  });

  test('a direct tab link has no invented home entry', () => {
    const state = router.getRehydratedState({
      stale: true,
      routes: [{ name: 'settings' }],
      index: 0,
    }, options);
    expect(currentName(state)).toBe('settings');
    expect(historyNames(state)).toEqual(['settings']);
    expect(router.getStateForAction(state, { type: 'GO_BACK' }, options)).toBeNull();
  });
});
