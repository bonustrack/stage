import { describe, expect, test } from 'bun:test';
import { developerModeDescription, isMenuPageOpen, isMenuPageRoute, railMenuPages, settingsMenuPages } from '../components/tabs/menuPages';
import { PAGES } from '../components/tabs/pages';

const INBOX_ROUTE = PAGES.inbox.href;

describe('menuPages', () => {
  test('lists Contacts, Dashboard, Storage and Inbox at the top level, Inbox only with a mailbox', () => {
    expect(settingsMenuPages(true, true).map((page) => page.href)).toEqual(['/contacts', '/dashboard', '/storage', INBOX_ROUTE]);
    expect(settingsMenuPages(true, false).map((page) => page.label)).toEqual(['Contacts', 'Dashboard', 'Storage']);
  });

  test('keeps Contacts and hides developer pages while developer mode is off', () => {
    expect(settingsMenuPages(false, true).map((page) => page.href)).toEqual(['/contacts']);
    expect(settingsMenuPages(false, false).map((page) => page.href)).toEqual(['/contacts']);
  });

  test('the rail leaves Contacts to the tab buttons and shows the developer pages, Inbox even without a mailbox', () => {
    expect(railMenuPages(true).map((page) => page.href)).toEqual(['/dashboard', '/storage', INBOX_ROUTE]);
    expect(railMenuPages(false)).toEqual([]);
  });

  test('the developer mode toggle names every developer page', () => {
    expect(developerModeDescription()).toBe('Show Check sync, Dashboard, Storage and Inbox on all your devices.');
  });

  test('a page stays open on its own sub pages only', () => {
    expect(isMenuPageOpen('/inbox', INBOX_ROUTE)).toBe(true);
    expect(isMenuPageOpen('/inbox/mail', INBOX_ROUTE)).toBe(true);
    expect(isMenuPageOpen('/inboxes', INBOX_ROUTE)).toBe(false);
    expect(isMenuPageOpen('/dashboard', INBOX_ROUTE)).toBe(false);
  });

  test('knows the menu page routes and nothing under settings', () => {
    for (const path of ['/contacts', '/dashboard', '/storage', '/inbox', '/inbox/mail']) expect(isMenuPageRoute(path)).toBe(true);
    for (const path of ['/', '/board', '/wallet', '/settings', '/settings/dashboard', '/channel/abc', '/storagebox']) {
      expect(isMenuPageRoute(path)).toBe(false);
    }
  });
});
