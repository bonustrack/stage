import type { AppIconName } from '../appIcons';

interface MenuPage {
  href: string;
  label: string;
  icon: AppIconName;
}

export const INBOX_ROUTE = '/inbox';

export const MENU_PAGES: readonly MenuPage[] = [
  { href: '/contacts', label: 'Contacts', icon: 'IconGroup1' },
  { href: '/dashboard', label: 'Dashboard', icon: 'IconBento' },
  { href: '/storage', label: 'Storage', icon: 'IconFolder1' },
  { href: INBOX_ROUTE, label: 'Inbox', icon: 'IconEmail1' },
];

export function menuPagesFor(hasMailbox: boolean, developerMode: boolean): readonly MenuPage[] {
  return MENU_PAGES.filter((page) => page.href === '/contacts' || (developerMode && (hasMailbox || page.href !== INBOX_ROUTE)));
}

export function isMenuPageOpen(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isMenuPageRoute(pathname: string): boolean {
  return MENU_PAGES.some((page) => isMenuPageOpen(pathname, page.href));
}
