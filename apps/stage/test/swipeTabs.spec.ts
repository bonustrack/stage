import { describe, expect, test } from 'bun:test';
import { PAGER_ORDER, PAGES, homeTabIndex, pagerShownAt, shownPagerPage } from '../components/tabs/pages';
import { swipedTabIndex } from '../components/tabs/TabsPager.model';

describe('mobile tab swipes', () => {
  const destination = (pathname: string, translation: number, velocity = 0): string => {
    const target = PAGER_ORDER[swipedTabIndex(homeTabIndex(pathname), 400, translation, velocity)];
    if (target === undefined) throw new Error('Missing swipe destination');
    return PAGES[target].href;
  };

  test('a right-to-left swipe from Chats opens Contacts, never Board', () => {
    expect(destination('/', -160)).toBe('/contacts');
    expect(destination('/', -20, -600)).toBe('/contacts');
    expect(PAGER_ORDER).toEqual(['chats', 'contacts', 'wallet', 'settings']);
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
    for (const path of ['/', '/board', '/contacts', '/wallet', '/settings']) expect(pagerShownAt(path, false)).toBe(true);
    expect(pagerShownAt('/contacts', true)).toBe(false);
    expect(pagerShownAt('/settings', true)).toBe(false);
    expect(pagerShownAt('/dashboard', false)).toBe(false);
    expect(pagerShownAt('/dashboard', true)).toBe(false);
    expect(pagerShownAt('/board', true)).toBe(true);
  });

  test('Board is the home view, not an additional swipe destination', () => {
    expect(homeTabIndex('/board')).toBe(0);
    expect(shownPagerPage('/board', true)).toBe('board');
    expect(shownPagerPage('/', false)).toBe('chats');
    expect(shownPagerPage('/contacts', true)).toBe('contacts');
    expect(shownPagerPage('/wallet', true)).toBe('wallet');
    expect(shownPagerPage('/settings', true)).toBe('settings');
  });
});
