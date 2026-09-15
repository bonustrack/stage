import { describe, expect, test } from 'bun:test';
import { isOnboardingRoute, nextRouteFor, safeNextRoute, signupHref } from '../components/onboarding/nextRoute.model';

describe('safeNextRoute', () => {
  test('keeps in-app routes and falls back to home for anything else', () => {
    expect(safeNextRoute('/settings/display')).toBe('/settings/display');
    expect(safeNextRoute('/0xabc?focus=1')).toBe('/0xabc?focus=1');
    expect(safeNextRoute(undefined)).toBe('/');
    expect(safeNextRoute('https://evil.example')).toBe('/');
    expect(safeNextRoute('//evil.example')).toBe('/');
    expect(safeNextRoute(['/wallet', '/x'])).toBe('/wallet');
  });

  test('never bounces back into the onboarding pages', () => {
    expect(safeNextRoute('/signup')).toBe('/');
    expect(safeNextRoute('/import?next=%2Fwallet')).toBe('/');
    expect(isOnboardingRoute('/signup')).toBe(true);
    expect(isOnboardingRoute('/wallet')).toBe(false);
  });
});

describe('signup redirect', () => {
  test('home needs no next, every other route is carried verbatim', () => {
    expect(nextRouteFor('/')).toBeUndefined();
    expect(nextRouteFor('/boorger')).toBe('/boorger');
    expect(signupHref(undefined)).toBe('/signup');
    expect(signupHref('/boorger')).toBe('/signup?next=%2Fboorger');
    expect(signupHref('/0xabc?focus=m1')).toBe('/signup?next=%2F0xabc%3Ffocus%3Dm1');
  });
});
