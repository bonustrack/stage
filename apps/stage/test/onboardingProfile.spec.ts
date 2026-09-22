import { describe, expect, test } from 'bun:test';
import {
  EMPTY_DETAILS, canContinueUsername, profileDetailsProblem, profileSetupFrom, usernameHint, usernameStatus, type ProfileDetails,
} from '../components/onboarding/Onboarding.profile.model';

const image = { uri: 'file:///a.png', mime: 'image/png' };
const details = (over: Partial<ProfileDetails>): ProfileDetails => ({ ...EMPTY_DETAILS, ...over });

describe('profileSetupFrom', () => {
  test('no username means nothing to set up, even with details', () => {
    expect(profileSetupFrom('', details({ displayName: 'Someone', image }))).toBeNull();
  });

  test('keeps only the fields that were filled in', () => {
    expect(profileSetupFrom('less', details({ displayName: '  ' }))).toEqual({ label: 'less' });
    expect(profileSetupFrom('less', details({ displayName: ' Less ', description: ' Builder ', image })))
      .toEqual({ label: 'less', displayName: 'Less', description: 'Builder', image });
  });
});

describe('profileDetailsProblem', () => {
  test('only the length and line limits produce a problem', () => {
    expect(profileDetailsProblem(EMPTY_DETAILS)).toBeNull();
    expect(profileDetailsProblem(details({ displayName: 'Less', description: 'Hi', image }))).toBeNull();
    expect(profileDetailsProblem(details({ displayName: 'x'.repeat(65) }))).toMatch(/limited/);
    expect(profileDetailsProblem(details({ displayName: 'two\nlines' }))).toMatch(/several lines/);
    expect(profileDetailsProblem(details({ description: 'x'.repeat(281) }))).toMatch(/About is limited/);
  });
});

describe('canContinueUsername', () => {
  test('continue needs an available username; skipping is the icon, not the button', () => {
    expect(canContinueUsername({ label: '', phase: 'idle' }, '')).toBe(false);
    expect(canContinueUsername({ label: 'less', phase: 'checking' }, 'less')).toBe(false);
    expect(canContinueUsername({ label: 'less', phase: 'unavailable' }, 'less')).toBe(false);
    expect(canContinueUsername({ label: 'less', phase: 'available' }, 'less')).toBe(true);
  });
});

describe('usernameStatus', () => {
  test('maps the claim state onto an icon with a tooltip', () => {
    expect(usernameStatus({ label: '', phase: 'idle' }, '')).toBeNull();
    expect(usernameStatus({ label: 'less', phase: 'checking' }, 'less')).toEqual({ kind: 'checking' });
    expect(usernameStatus({ label: 'lessss', phase: 'available' }, 'lessss')).toEqual({ kind: 'ok', tip: 'Available' });
    expect(usernameStatus({ label: 'lessss', phase: 'unavailable' }, 'lessss')).toEqual({ kind: 'error', tip: 'Already taken' });
    expect(usernameStatus({ label: 'ab', phase: 'invalid', detail: 'At least 6 characters.' }, 'ab')).toEqual({ kind: 'error', tip: 'At least 6 characters.' });
    expect(usernameStatus({ label: 'alice-', phase: 'invalid', detail: 'Only a-z, 0-9 and single inner hyphens.' }, 'alice-'))
      .toEqual({ kind: 'error', tip: 'Cannot end with a hyphen' });
  });
  test('only a failed check keeps a text hint under the field', () => {
    expect(usernameHint({ label: 'ab', phase: 'invalid', detail: 'x' }, 'ab')).toBeUndefined();
    expect(usernameHint({ label: 'lessss', phase: 'failed', detail: 'offline' }, 'lessss')).toContain('offline');
  });
});
