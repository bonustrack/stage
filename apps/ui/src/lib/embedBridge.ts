/** When the messenger runs inside an iframe (the embed widget), notify the
 *  host page of inbound messages so it can badge its launcher button. No-op
 *  on the standalone metro.box site. */

export function isEmbedded(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

export function postUnreadToParent(count: number): void {
  if (count > 0 && isEmbedded()) {
    window.parent.postMessage({ type: 'metro:inbound', count }, '*');
  }
}
