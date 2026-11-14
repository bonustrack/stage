import { describe, expect, test } from 'bun:test';
import { LEGAL_CONTACT, LEGAL_ENTITY, legalPlainText } from '../components/legal/legal.model';
import { PRIVACY } from '../components/legal/privacy.model';
import { TERMS } from '../components/legal/terms.model';
import { isOnboardingRoute, isPublicRoute } from '../components/onboarding/nextRoute.model';

describe('legal pages', () => {
  test('the terms ban child sexual abuse, explain reporting and blocking, and name who to contact', () => {
    const terms = legalPlainText(TERMS);
    expect(terms).toContain('child sexual abuse');
    expect(terms).toContain('report a message');
    expect(terms).toContain('block a person');
    expect(terms).toContain(LEGAL_ENTITY);
    expect(terms).toContain(LEGAL_CONTACT);
  });

  test('the privacy policy covers deletion, children and the contact', () => {
    const privacy = legalPlainText(PRIVACY);
    expect(PRIVACY.sections.map((s) => s.heading)).toEqual(expect.arrayContaining(['Deleting your data', 'Children', 'Service providers']));
    expect(privacy).toContain(LEGAL_CONTACT);
  });

  test('the terms and privacy pages open without an account, and are not onboarding steps', () => {
    expect(isPublicRoute('/terms')).toBe(true);
    expect(isPublicRoute('/privacy')).toBe(true);
    expect(isPublicRoute('/settings')).toBe(false);
    expect(isOnboardingRoute('/terms')).toBe(false);
  });
});
