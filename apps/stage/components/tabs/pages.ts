import { isPeerHandleSegment } from '@stage-labs/client/routing/handles';
import { isAppRouteSegment, isPathUnder, pathSegments, type AppRootHref, type AppRouteSegment } from '@stage-labs/client/routing/routes';
import type { HomeView } from '../../lib/homeView';
import type { AppIconName } from '../appIcons';

type Renderer = 'pager' | 'route';

type Split = 'pane' | 'rail' | 'none';

type TabRoute = 'index' | 'board' | 'contacts' | 'wallet' | 'settings';

interface PageEntry {
  readonly href: AppRootHref;
  readonly label: string;
  readonly icon?: AppIconName;
  readonly tabRoute?: TabRoute;
  readonly tabBar?: boolean;
  readonly render: { readonly native: Renderer; readonly web: Renderer };
  readonly split: Split;
  readonly restore?: false;
  readonly home?: HomeView;
  readonly menu?: { readonly devOnly: boolean; readonly needsMailbox?: boolean };
}

const IN_PAGER = { native: 'pager', web: 'pager' } as const;

const BY_ROUTE = { native: 'route', web: 'route' } as const;

export const PAGES = {
  chats: {
    href: '/',
    label: 'Chats',
    icon: 'IconBubble3',
    tabRoute: 'index',
    tabBar: true,
    render: IN_PAGER,
    split: 'pane',
    restore: false,
    home: 'chats',
  },
  board: { href: '/board', label: 'Board', tabRoute: 'board', render: IN_PAGER, split: 'rail', home: 'board' },
  contacts: {
    href: '/contacts',
    label: 'Contacts',
    icon: 'IconGroup1',
    tabRoute: 'contacts',
    tabBar: true,
    render: BY_ROUTE,
    split: 'pane',
    menu: { devOnly: false },
  },
  wallet: {
    href: '/wallet',
    label: 'Wallet',
    icon: 'IconWallet4',
    tabRoute: 'wallet',
    tabBar: true,
    render: IN_PAGER,
    split: 'pane',
    restore: false,
  },
  settings: {
    href: '/settings',
    label: 'Settings',
    tabRoute: 'settings',
    render: { native: 'pager', web: 'route' },
    split: 'pane',
    restore: false,
  },
  dashboard: { href: '/dashboard', label: 'Dashboard', icon: 'IconBento', render: BY_ROUTE, split: 'pane', menu: { devOnly: true } },
  storage: { href: '/storage', label: 'Storage', icon: 'IconFolder1', render: BY_ROUTE, split: 'pane', menu: { devOnly: true } },
  inbox: {
    href: '/inbox',
    label: 'Inbox',
    icon: 'IconEmail1',
    render: BY_ROUTE,
    split: 'pane',
    menu: { devOnly: true, needsMailbox: true },
  },
} as const satisfies Record<string, PageEntry>;

export type PageId = keyof typeof PAGES;

type Page = PageEntry & { readonly id: PageId };

export type PagerPageId = { [K in PageId]: 'pager' extends (typeof PAGES)[K]['render']['native' | 'web'] ? K : never }[PageId];

function isPagerPage(page: Page): page is Page & { readonly id: PagerPageId } {
  return page.render.native === 'pager' || page.render.web === 'pager';
}

type SegmentOf<H> = H extends `/${infer S}` ? S : never;

type PageSegment = SegmentOf<(typeof PAGES)[PageId]['href']>;

interface RouteEntry {
  readonly split: Split;
  readonly param?: true;
}

const OTHER_ROUTES = {
  account: { split: 'pane' },
  'add-members': { split: 'pane' },
  channel: { split: 'pane', param: true },
  frame: { split: 'pane' },
  import: { split: 'none' },
  new: { split: 'pane' },
  profile: { split: 'pane', param: true },
  scan: { split: 'pane' },
  signup: { split: 'none' },
} as const satisfies Record<Exclude<AppRouteSegment, PageSegment>, RouteEntry>;

export const ROUTES = { newChat: '/new', scan: '/scan', signup: '/signup', import: '/import' } as const satisfies Record<
  string,
  AppRootHref
>;

export const PAGE_LIST: readonly Page[] = (Object.keys(PAGES) as PageId[]).map((id) => ({ id, ...PAGES[id] }));

const OTHER_ROUTE_MAP: ReadonlyMap<string, RouteEntry> = new Map(Object.entries(OTHER_ROUTES));

export function pageAt(pathname: string): Page | undefined {
  return PAGE_LIST.find((page) => isPathUnder(pathname, page.href));
}

export function tabPageAt(pathname: string): Page | undefined {
  return PAGE_LIST.find((page) => page.tabRoute !== undefined && page.href === pathname);
}

interface TabBarPage extends Page {
  readonly icon: AppIconName;
  readonly tabRoute: TabRoute;
}

function isTabBarPage(page: Page): page is TabBarPage {
  return page.tabBar === true && page.icon !== undefined && page.tabRoute !== undefined;
}

export const TAB_BAR_PAGES: readonly TabBarPage[] = PAGE_LIST.filter(isTabBarPage);

export interface MenuPage extends Page {
  readonly icon: AppIconName;
  readonly menu: NonNullable<PageEntry['menu']>;
}

function isMenuPage(page: Page): page is MenuPage {
  return page.menu !== undefined && page.icon !== undefined;
}

export const MENU_PAGES: readonly MenuPage[] = PAGE_LIST.filter(isMenuPage);

export const HIDDEN_TAB_ROUTES: readonly TabRoute[] = PAGE_LIST.flatMap((page) =>
  page.tabRoute === undefined || page.tabBar === true ? [] : [page.tabRoute],
);

export const PAGER_ORDER: readonly PagerPageId[] = PAGE_LIST.filter(isPagerPage).map((page) => page.id);

function pagerPageAt(pathname: string, boardHome: boolean): PagerPageId {
  const page = pageAt(pathname);
  const id = page !== undefined && isPagerPage(page) ? page.id : page?.menu !== undefined ? 'settings' : 'chats';
  return id === 'chats' && boardHome ? 'board' : id;
}

export function homeTabIndex(pathname: string, boardHome: boolean): number {
  return PAGER_ORDER.indexOf(pagerPageAt(pathname, boardHome));
}

export function activeTabOf(pathname: string, boardHome: boolean): PageId | null {
  const page = pageAt(pathname);
  if (page?.menu !== undefined) return page.tabBar === true ? page.id : null;
  const id = pagerPageAt(pathname, boardHome);
  const shown: PageEntry = PAGES[id];
  if (shown.home !== undefined) return 'chats';
  return shown.tabBar === true ? id : null;
}

function otherRouteAt(pathname: string): RouteEntry | undefined {
  const [root, ...rest] = pathSegments(pathname);
  const route = root === undefined ? undefined : OTHER_ROUTE_MAP.get(root);
  return route?.param === true && rest.length === 0 ? undefined : route;
}

function isPeerRoute(pathname: string): boolean {
  const segments = pathSegments(pathname);
  return segments.length === 1 && isPeerHandleSegment(segments[0]);
}

export function splitAt(pathname: string): Split {
  const split = pageAt(pathname)?.split ?? otherRouteAt(pathname)?.split;
  if (split !== undefined) return split;
  return isPeerRoute(pathname) ? 'pane' : 'none';
}

export function rendererOf(page: Pick<PageEntry, 'render'>, web: boolean): Renderer {
  return web ? page.render.web : page.render.native;
}

export function isRestorableRoute(path: string): boolean {
  const [root] = pathSegments(path);
  if (root === undefined || PAGE_LIST.some((page) => page.restore === false && page.href === path)) return false;
  return isAppRouteSegment(root) || isPeerRoute(path);
}

export function isOnboardingRoute(pathname: string): boolean {
  return pathname === ROUTES.signup || pathname === ROUTES.import;
}

export function chatsTabOpensNewChat(pathname: string, wide: boolean): boolean {
  return !wide && pathname === PAGES.chats.href;
}

export function newChatHref(wide: boolean, board: boolean): typeof PAGES.chats.href | typeof ROUTES.newChat {
  return wide && !board ? PAGES.chats.href : ROUTES.newChat;
}
