/** When the messenger runs inside an iframe (the embed widget), notify the
 *  host page of inbound messages so it can badge its launcher button. No-op
 *  on the standalone metro.box site. */

export function runningInIframe(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

export function postUnreadToParent(count: number): void {
  if (count > 0 && runningInIframe()) {
    window.parent.postMessage({ type: 'metro:inbound', count }, '*');
  }
}

/** When embedded, let the host page drive the color scheme so the widget
 *  matches the surrounding UI instantly. The host posts
 *  `{ type: 'metro:theme', theme: 'light' | 'dark' | 'system' }`. */
export function installEmbedThemeBridge(apply: (t: 'light' | 'dark' | 'system') => void): void {
  if (!runningInIframe()) return;
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; theme?: string } | null;
    if (d?.type !== 'metro:theme') return;
    if (d.theme === 'light' || d.theme === 'dark' || d.theme === 'system') apply(d.theme);
  });
  /** Tell the host we're ready so it can push the current theme immediately. */
  window.parent.postMessage({ type: 'metro:ready' }, '*');
}
