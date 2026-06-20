
export function runningInIframe(): boolean {
  return typeof window !== 'undefined' && window.self !== window.top;
}

export function postUnreadToParent(count: number): void {
  if (count > 0 && runningInIframe()) {
    window.parent.postMessage({ type: 'metro:inbound', count }, '*');
  }
}

export function postCloseToParent(): void {
  if (runningInIframe()) window.parent.postMessage({ type: 'metro:close' }, '*');
}

export function installEmbedThemeBridge(apply: (t: 'light' | 'dark' | 'system') => void): void {
  if (!runningInIframe()) return;
  window.addEventListener('message', (e: MessageEvent) => {
    const d = e.data as { type?: string; theme?: string } | null;
    if (d?.type !== 'metro:theme') return;
    if (d.theme === 'light' || d.theme === 'dark' || d.theme === 'system') apply(d.theme);
  });
  window.parent.postMessage({ type: 'metro:ready' }, '*');
}
