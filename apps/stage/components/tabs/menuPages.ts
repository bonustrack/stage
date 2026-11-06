import { isPathUnder } from '@stage-labs/client/routing/routes';
import { MENU_PAGES, pageAt, type MenuPage } from './pages';

function shownWith(page: MenuPage, developerMode: boolean): boolean {
  return !page.menu.devOnly || developerMode;
}

export function settingsMenuPages(developerMode: boolean, hasMailbox: boolean): readonly MenuPage[] {
  return MENU_PAGES.filter((page) => shownWith(page, developerMode) && (page.menu.needsMailbox !== true || hasMailbox));
}

export function railMenuPages(developerMode: boolean): readonly MenuPage[] {
  return MENU_PAGES.filter((page) => page.tabBar !== true && shownWith(page, developerMode));
}

export function isMenuPageOpen(pathname: string, href: string): boolean {
  return isPathUnder(pathname, href);
}

export function isMenuPageRoute(pathname: string): boolean {
  return pageAt(pathname)?.menu !== undefined;
}

function spokenList(items: readonly string[]): string {
  const last = items.at(-1);
  return items.length < 2 || last === undefined ? items.join('') : `${items.slice(0, -1).join(', ')} and ${last}`;
}

export function developerModeDescription(): string {
  const pages = MENU_PAGES.filter((page) => page.menu.devOnly).map((page) => page.label);
  return `Show ${spokenList(['Check sync', ...pages])} on all your devices.`;
}
