export function isAppInFront(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'visible' && document.hasFocus();
}

export function subscribeAppInFront(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  document.addEventListener('visibilitychange', onChange);
  window.addEventListener('focus', onChange);
  window.addEventListener('blur', onChange);
  return () => {
    document.removeEventListener('visibilitychange', onChange);
    window.removeEventListener('focus', onChange);
    window.removeEventListener('blur', onChange);
  };
}
