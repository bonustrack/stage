import type { View, ViewStyle } from 'react-native';
import type { ChromeClass, DocumentTheme, PaneScope } from './webChrome.core';

export { GUTTER_SCROLLBAR, SCROLLBAR_ON_HOVER, SELF_SCROLLBAR } from './webChrome.core';

export type RenderedNode = View;

export const PANE_LEFT_PAD: ViewStyle = {};

export const RIGHT_PANE_PAD: ViewStyle = {};

export const RIGHT_PANE_INSET: ViewStyle = {};

export const STICKY_TOP: ViewStyle = {};

export const SELF_SCROLL: ViewStyle = {};

export const STICKY_UNDER_CHROME: ViewStyle = {};

export function underTopChrome(offset: number): string {
  return `${offset}px`;
}

export function gutterScrollbarWidth(): number {
  return 0;
}

export function stickyAt(top: string, zIndex: number): ViewStyle | null {
  void top;
  void zIndex;
  return null;
}

export function pinnedTop(zIndex: number): ViewStyle {
  return { position: 'absolute', top: 0, left: 0, right: 0, zIndex };
}

export function pinnedBottom(zIndex: number): ViewStyle {
  return { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex };
}

export function viewportFill(zIndex?: number): ViewStyle {
  return { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex };
}

export function pinnedEdges(edges: { top?: number; bottom?: number; left?: number; right?: number }, zIndex: number): ViewStyle {
  return { position: 'absolute', ...edges, zIndex };
}

export function isRendered(node: unknown): boolean {
  void node;
  return false;
}

export function setTopInset(px: number): void {
  void px;
}

export function setPaneScope(scope: PaneScope | null): void {
  void scope;
}

export function setChromeClass(name: ChromeClass, on: boolean): void {
  void name;
  void on;
}

export function applyDocumentTheme(theme: DocumentTheme): void {
  void theme;
}

export function applyWebGlobalStyles(): void {
  return undefined;
}

export function writeChromeRule(id: string, rule: string): void {
  void id;
  void rule;
}

export function paneLeftRule(railWidth: number, paneWidth: number): string {
  void railWidth;
  void paneWidth;
  return '';
}

export function rightPaneRule(width: number): string {
  void width;
  return '';
}
