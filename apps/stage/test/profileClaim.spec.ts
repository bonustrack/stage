import { describe, expect, test } from 'bun:test';
import { claimStatusTone, localLabelProblem, normalizeLabel, sanitizeLabelInput, usernameHint } from '../components/profile/username.model';

describe('claim model', () => {
  test('normalises input and reports local problems before hitting the network', () => {
    expect(normalizeLabel('  Fabien.stage.base.eth ')).toBe('fabien');
    expect(localLabelProblem('')).toBeNull();
    expect(localLabelProblem('abc')).toContain('At least 6');
    expect(localLabelProblem('fab_ien')).toContain('hyphens');
    expect(localLabelProblem('fabien')).toBeNull();
  });

  test('each phase has a tone, and a failed claim says why', () => {
    expect(claimStatusTone({ label: 'fabien', phase: 'available' })).toBe('success');
    expect(claimStatusTone({ label: 'fabien', phase: 'claimed' })).toBe('success');
    expect(claimStatusTone({ label: 'fabien', phase: 'unavailable' })).toBe('danger');
    expect(claimStatusTone({ label: 'fabien', phase: 'checking' })).toBe('secondary');
    expect(usernameHint({ label: 'fabien', phase: 'failed', detail: 'boom' }, 'fabien')).toBe('Could not claim the name: boom');
    expect(usernameHint({ label: 'fabien', phase: 'claimed' }, 'fabien')).toBe(
      '@fabien is yours. It can take a minute to show everywhere.',
    );
  });
});

describe('sanitizeLabelInput', () => {
  test('keeps only lowercase letters, digits and hyphens and drops a leading hyphen', () => {
    expect(sanitizeLabelInput('Fab Ien!')).toBe('fabien');
    expect(sanitizeLabelInput('--my-name-')).toBe('my-name-');
    expect(sanitizeLabelInput('dsdsd-----ds')).toBe('dsdsd-ds');
    expect(sanitizeLabelInput('ÉTÉ 2026')).toBe('t2026');
  });
});
