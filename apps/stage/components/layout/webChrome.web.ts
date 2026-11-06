import type { View, ViewStyle } from 'react-native';
import { GUTTER_SCROLLBAR, type ChromeClass, type DocumentTheme, type PaneScope } from './webChrome.core';
import { WEB_GLOBAL_CSS } from './webChrome.styles';

export { GUTTER_SCROLLBAR, SCROLLBAR_ON_HOVER, SELF_SCROLLBAR } from './webChrome.core';

const PANE_LEFT = 'var(--stage-pane-left, 0px)';
const RIGHT_PANE = 'var(--stage-right-pane, 0px)';
const TOP_INSET = 'var(--stage-top-inset, 0px)';

type WebStyle = Record<string, string | number | undefined>;

function css(style: WebStyle): ViewStyle {
  return style;
}

export type RenderedNode = View;

export const PANE_LEFT_PAD: ViewStyle = css({ paddingLeft: PANE_LEFT });

export const RIGHT_PANE_PAD: ViewStyle = css({ paddingRight: RIGHT_PANE });

export const RIGHT_PANE_INSET: ViewStyle = css({ right: RIGHT_PANE });

export const STICKY_TOP: ViewStyle = css({ position: 'sticky', top: 0, zIndex: 2 });

export const SELF_SCROLL: ViewStyle = css({ overflowY: 'auto' });

export const STICKY_UNDER_CHROME: ViewStyle = css({ position: 'sticky', top: TOP_INSET, zIndex: 2 });

export function underTopChrome(offset: number): string {
  return `calc(${TOP_INSET} + ${offset}px)`;
}

let reservedGutter: number | undefined;

export function gutterScrollbarWidth(): number {
  if (typeof document === 'undefined') return 0;
  if (reservedGutter === undefined) {
    const probe = document.createElement('div');
    Object.assign(probe.dataset, GUTTER_SCROLLBAR.dataSet);
    probe.style.cssText = 'position: absolute; visibility: hidden; width: 100px; overflow-y: auto';
    document.body.append(probe);
    reservedGutter = probe.offsetWidth - probe.clientWidth;
    probe.remove();
  }
  return reservedGutter;
}

export function stickyAt(top: string, zIndex: number): ViewStyle | null {
  return css({ position: 'sticky', top, zIndex });
}

export function pinnedTop(zIndex: number): ViewStyle {
  return css({ position: 'fixed', top: 0, left: PANE_LEFT, right: 0, zIndex });
}

export function pinnedBottom(zIndex: number): ViewStyle {
  return css({ position: 'fixed', bottom: 0, left: PANE_LEFT, right: 0, zIndex });
}

export function viewportFill(zIndex?: number): ViewStyle {
  return css({ position: 'fixed', top: 0, bottom: 0, left: 0, right: 0, zIndex });
}

export function pinnedEdges(edges: { top?: number; bottom?: number; left?: number; right?: number }, zIndex: number): ViewStyle {
  return css({ position: 'fixed', ...edges, zIndex });
}

export function isRendered(node: unknown): boolean {
  return node instanceof HTMLElement && node.getClientRects().length > 0;
}

function root(): HTMLElement | null {
  return typeof document === 'undefined' ? null : document.documentElement;
}

export function setTopInset(px: number): void {
  root()?.style.setProperty('--stage-top-inset', `${px}px`);
}

export function setPaneScope(scope: PaneScope | null): void {
  const html = root();
  if (html === null) return;
  if (scope === null) delete html.dataset.stagepane;
  else html.dataset.stagepane = scope;
}

export function setChromeClass(name: ChromeClass, on: boolean): void {
  root()?.classList.toggle(`stage-${name}`, on);
}

export function applyDocumentTheme(theme: DocumentTheme): void {
  const html = root();
  if (html === null) return;
  html.style.colorScheme = theme.dark ? 'dark' : 'light';
  html.style.backgroundColor = theme.background;
  html.style.setProperty('--stage-scrollbar-thumb', theme.scrollbarThumb);
  document.getElementById('stage-boot')?.remove();
}

export function applyWebGlobalStyles(): void {
  writeChromeRule('stage-web-global-styles', WEB_GLOBAL_CSS);
}

export function writeChromeRule(id: string, rule: string): void {
  if (typeof document === 'undefined') return;
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = rule;
}

export function paneLeftRule(railWidth: number, paneWidth: number): string {
  return `[data-stagepane="1"] { --stage-pane-left: ${railWidth + paneWidth}px; } [data-stagepane="rail"] { --stage-pane-left: ${railWidth}px; }`;
}

export function rightPaneRule(width: number): string {
  return `:root { --stage-right-pane: ${width}px; }`;
}
