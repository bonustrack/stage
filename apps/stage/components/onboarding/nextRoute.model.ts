import { PAGES, ROUTES, isOnboardingRoute } from '../tabs/pages';

export function safeNextRoute(next: string | string[] | undefined): string {
  const value = Array.isArray(next) ? next[0] : next;
  if (value === undefined || !value.startsWith('/') || value.startsWith('//')) return PAGES.chats.href;
  if (isOnboardingRoute(value.split('?')[0] ?? value)) return PAGES.chats.href;
  return value;
}

export function nextRouteFor(route: string): string | undefined {
  return route === PAGES.chats.href ? undefined : route;
}

export function signupHref(next: string | undefined): string {
  return next === undefined ? ROUTES.signup : `${ROUTES.signup}?next=${encodeURIComponent(next)}`;
}
