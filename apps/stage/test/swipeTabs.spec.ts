import { describe, expect, test } from 'bun:test';
import {
  hasTabsPager,
  homePageName,
  homeTabIndex,
  swipedTabIndex,
  tabIndexIn,
  tabOrder,
  TAB_HREF,
  TAB_ORDER,
} from '../components/SwipeTabs.model';

describe('mobile tab swipes', () => {
  const destination = (pathname: string, translation: number, velocity = 0): string => {
    const target = TAB_ORDER[swipedTabIndex(homeTabIndex(pathname), 400, translation, velocity)];
    if (target === undefined) throw new Error('Missing swipe destination');
    return TAB_HREF[target];
  };

  test('a right-to-left swipe from Chats opens Contacts, never Board', () => {
    expect(destination('/', -160)).toBe('/contacts');
    expect(destination('/', -20, -600)).toBe('/contacts');
    expect(TAB_ORDER).toEqual(['index', 'contacts', 'wallet', 'settings']);
  });

  test('the remaining destinations follow the visible tab order in both directions', () => {
    expect(destination('/contacts', -160)).toBe('/wallet');
    expect(destination('/contacts', 160)).toBe('/');
    expect(destination('/wallet', -160)).toBe('/settings');
    expect(destination('/wallet', 160)).toBe('/contacts');
    expect(destination('/settings', 160)).toBe('/wallet');
  });

  test('short drags snap back and the end tabs stay in bounds', () => {
    expect(destination('/', -80)).toBe('/');
    expect(destination('/', -81)).toBe('/contacts');
    expect(destination('/', 160)).toBe('/');
    expect(destination('/settings', -160)).toBe('/settings');
    expect(destination('/wallet', 0, 600)).toBe('/wallet');
  });

  test('Contacts keeps the native pager mounted while standalone web menu pages retain their own screens', () => {
    for (const path of ['/', '/board', '/contacts', '/wallet', '/settings']) expect(hasTabsPager(path, false)).toBe(true);
    expect(hasTabsPager('/contacts', true)).toBe(false);
    expect(hasTabsPager('/settings', true)).toBe(false);
    expect(hasTabsPager('/dashboard', false)).toBe(false);
    expect(hasTabsPager('/dashboard', true)).toBe(false);
    expect(hasTabsPager('/board', true)).toBe(true);
  });

  test('Board is the home view, not an additional swipe destination', () => {
    expect(homeTabIndex('/board')).toBe(0);
    expect(homePageName('/board', true)).toBe('board');
    expect(homePageName('/', false)).toBe('index');
    expect(homePageName('/contacts', true)).toBe('contacts');
    expect(homePageName('/wallet', true)).toBe('wallet');
    expect(homePageName('/settings', true)).toBe('settings');
  });

  test('a build without the wallet drops its tab and every later tab moves up one place', () => {
    const order = tabOrder(false);
    expect(order).toEqual(['index', 'contacts', 'settings']);
    expect(tabIndexIn(order, '/settings')).toBe(2);
    expect(tabIndexIn(order, '/dashboard')).toBe(2);
    expect(tabIndexIn(order, '/wallet')).toBe(0);
  });
});
