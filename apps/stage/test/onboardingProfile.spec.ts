import { describe, expect, test } from 'bun:test';
import { canContinueProfile, profileSetupFrom, profileStepProblem } from '../components/onboarding/Onboarding.profile.model';

const image = { uri: 'file:///a.png', mime: 'image/png' };

describe('profileSetupFrom', () => {
  test('no username means nothing to set up', () => {
    expect(profileSetupFrom('', 'Someone', image)).toBeNull();
  });

  test('keeps only the fields that were filled in', () => {
    expect(profileSetupFrom('less', '  ', null)).toEqual({ label: 'less' });
    expect(profileSetupFrom('less', ' Less ', image)).toEqual({ label: 'less', displayName: 'Less', image });
  });
});

describe('profileStepProblem', () => {
  test('a name or picture without a username has nowhere to live', () => {
    expect(profileStepProblem('', 'Less', false)).toBe('Pick a username to save your name and picture.');
    expect(profileStepProblem('', '', true)).toBe('Pick a username to save your name and picture.');
    expect(profileStepProblem('', '', false)).toBeNull();
    expect(profileStepProblem('less', 'Less', true)).toBeNull();
  });

  test('display name limits still apply', () => {
    expect(profileStepProblem('less', 'x'.repeat(65), false)).toMatch(/limited/);
    expect(profileStepProblem('less', 'two\nlines', false)).toMatch(/several lines/);
  });
});

describe('canContinueProfile', () => {
  test('empty form continues as a skip, a username must be available', () => {
    expect(canContinueProfile({ label: '', phase: 'idle' }, '', '', false)).toBe(true);
    expect(canContinueProfile({ label: 'less', phase: 'checking' }, 'less', '', false)).toBe(false);
    expect(canContinueProfile({ label: 'less', phase: 'unavailable' }, 'less', '', false)).toBe(false);
    expect(canContinueProfile({ label: 'less', phase: 'available' }, 'less', 'Less', true)).toBe(true);
  });
});
