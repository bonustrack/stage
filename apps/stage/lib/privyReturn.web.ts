import { DESKTOP_OAUTH_REDIRECT, hashQuery, oauthReturnOf, withOAuthReturn } from './privyReturn.model';

const page = typeof window === 'undefined' ? null : window.location;
const returned = page === null ? null : (oauthReturnOf(page.search) ?? oauthReturnOf(hashQuery(page.hash)));
let restored = false;

export function returnedOAuthProvider(): string | null {
  return returned?.privy_oauth_provider ?? null;
}

export function restorePrivyOAuthReturn(): void {
  if (returned === null || restored) return;
  restored = true;
  if (oauthReturnOf(window.location.search) !== null) return;
  window.history.replaceState(window.history.state, '', withOAuthReturn(window.location.href, returned));
}

export function runsInDesktopShell(): boolean {
  return (globalThis as { stageDesktop?: unknown }).stageDesktop !== undefined;
}

export function privyOAuthRedirectUrl(): string {
  return runsInDesktopShell() ? DESKTOP_OAUTH_REDIRECT : window.location.origin;
}
