import { describe, expect, test } from 'bun:test';
import { INBOX_ROUTE, isMenuPageOpen, isMenuPageRoute, menuPagesFor } from '../components/tabs/menuPages';

describe('menuPages', () => {
  test('lists Contacts, Dashboard, Storage and Inbox at the top level, Inbox only with a mailbox', () => {
    expect(menuPagesFor(true, true).map((page) => page.href)).toEqual(['/contacts', '/dashboard', '/storage', INBOX_ROUTE]);
    expect(menuPagesFor(false, true).map((page) => page.label)).toEqual(['Contacts', 'Dashboard', 'Storage']);
  });

  test('keeps Contacts and hides developer pages while developer mode is off', () => {
    expect(menuPagesFor(true, false).map((page) => page.href)).toEqual(['/contacts']);
    expect(menuPagesFor(false, false).map((page) => page.href)).toEqual(['/contacts']);
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
