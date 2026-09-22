import { describe, expect, test } from 'bun:test';
import { usernameHint, usernameReady, usernameStatus } from '../components/UsernameField.model';

describe('usernameReady', () => {
  test('only an available username enables the action', () => {
    expect(usernameReady({ label: '', phase: 'idle' }, '')).toBe(false);
    expect(usernameReady({ label: 'less', phase: 'checking' }, 'less')).toBe(false);
    expect(usernameReady({ label: 'less', phase: 'unavailable' }, 'less')).toBe(false);
    expect(usernameReady({ label: 'less', phase: 'available' }, 'less')).toBe(true);
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

  test('the text hint under the field covers claimed and failed only', () => {
    expect(usernameHint({ label: 'ab', phase: 'invalid', detail: 'x' }, 'ab')).toBeUndefined();
    expect(usernameHint({ label: 'lessss', phase: 'available' }, 'lessss')).toBeUndefined();
    expect(usernameHint({ label: 'lessss', phase: 'claiming' }, 'lessss')).toBeUndefined();
    expect(usernameHint({ label: 'lessss', phase: 'claimed' }, 'lessss')).toContain('lessss');
    expect(usernameHint({ label: 'lessss', phase: 'failed', detail: 'offline' }, 'lessss')).toContain('offline');
  });
});
