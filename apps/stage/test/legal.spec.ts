import { describe, expect, test } from 'bun:test';
import { LEGAL_CONTACT, LEGAL_ENTITY, legalPlainText } from '../components/legal/legal.model';
import { PRIVACY } from '../components/legal/privacy.model';
import { ACCOUNT_DELETION } from '../components/legal/deletion.model';
import { deleteFailedMessage, deleteMessage } from '../components/settings/accountRemoval.model';
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

  test('the deletion page explains the in-app path, the email path and what is kept, and opens without an account', () => {
    const page = legalPlainText(ACCOUNT_DELETION);
    expect(page).toContain('Settings, then Advanced, then Delete account');
    expect(page).toContain(LEGAL_CONTACT);
    expect(ACCOUNT_DELETION.sections.map((s) => s.heading)).toEqual(expect.arrayContaining(['What is deleted', 'What is kept']));
    expect(isPublicRoute('/delete-account')).toBe(true);
  });

  test('the delete confirm says it can not be undone, and a failure says nothing left the device', () => {
    expect(deleteMessage('@alice1')).toContain('can not be undone');
    expect(deleteFailedMessage('Network down.')).toBe(
      `Network down. Nothing was removed from this device. Try again, or email ${LEGAL_CONTACT}.`,
    );
  });
});
