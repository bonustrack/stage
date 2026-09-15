export const SIGNUP_ROUTE = '/signup';
export const IMPORT_ROUTE = '/import';

const ONBOARDING_ROUTES: ReadonlySet<string> = new Set([SIGNUP_ROUTE, IMPORT_ROUTE]);

export function isOnboardingRoute(pathname: string): boolean {
  return ONBOARDING_ROUTES.has(pathname);
}

export function safeNextRoute(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (value === undefined || !value.startsWith('/') || value.startsWith('//')) return '/';
  if (isOnboardingRoute(value.split('?')[0] ?? value)) return '/';
  return value;
}

export function nextRouteFor(route: string): string | undefined {
  return route === '/' ? undefined : route;
}

export function signupHref(next: string | undefined): string {
  return next === undefined ? SIGNUP_ROUTE : `${SIGNUP_ROUTE}?next=${encodeURIComponent(next)}`;
}
