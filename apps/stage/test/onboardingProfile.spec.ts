import { describe, expect, test } from 'bun:test';
import { EMPTY_DETAILS, profileDetailsProblem, profileSetupFrom, type ProfileDetails } from '../components/onboarding/Onboarding.profile.model';

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
