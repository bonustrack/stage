export function domElementOf(node: unknown, web: boolean): HTMLElement | null {
  return web && typeof HTMLElement !== 'undefined' && node instanceof HTMLElement ? node : null;
}
