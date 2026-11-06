import { describe, expect, test } from 'bun:test';
import { EMPTY_DETAILS, profileSetupFrom, type ProfileDetails } from '../components/onboarding/Onboarding.profile.model';

const image = { uri: 'file:///a.png', mime: 'image/png' };
const details = (over: Partial<ProfileDetails>): ProfileDetails => ({ ...EMPTY_DETAILS, ...over });

describe('profileSetupFrom', () => {
  test('no username means nothing to set up, even with details', () => {
    expect(profileSetupFrom('', details({ displayName: 'Someone', image }))).toBeNull();
  });

  test('picker-only metadata does not enter the durable public profile', () => {
    const picked = { ...image, type: 'image', name: 'synthetic.png' };
    expect(profileSetupFrom('synthetic123', details({ image: picked }))?.image).toEqual({ ...image, name: 'synthetic.png' });
  });

  test('keeps only the fields that were filled in', () => {
    expect(profileSetupFrom('less', details({ displayName: '  ' }))).toEqual({ label: 'less' });
    expect(profileSetupFrom('less', details({ displayName: ' Less ', description: ' Builder ', image }))).toEqual({
      label: 'less',
      displayName: 'Less',
      description: 'Builder',
      image,
    });
  });
});
