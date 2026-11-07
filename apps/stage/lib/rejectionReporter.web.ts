import { report } from './errorPolicy';

function reportRejection(event: PromiseRejectionEvent): void {
  event.preventDefault();
  report('unhandled', event.reason);
}

export function reportUnhandledRejections(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('unhandledrejection', reportRejection);
}
