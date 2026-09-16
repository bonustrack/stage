import { describe, expect, test } from 'bun:test';
import { canClaim, claimStatusText, localLabelProblem, normalizeLabel, sanitizeLabelInput } from '../components/settings/ProfileSettings.claim.model';

describe('claim model', () => {
  test('normalises input and reports local problems before hitting the network', () => {
    expect(normalizeLabel('  Fabien.stage.base.eth ')).toBe('fabien');
    expect(localLabelProblem('')).toBeNull();
    expect(localLabelProblem('abc')).toContain('At least 6');
    expect(localLabelProblem('fab_ien')).toContain('Lowercase');
    expect(localLabelProblem('fabien')).toBeNull();
  });

  test('only an available name can be claimed and every phase has a message', () => {
    expect(canClaim({ label: 'fabien', phase: 'available' })).toBe(true);
    expect(canClaim({ label: 'fabien', phase: 'checking' })).toBe(false);
    expect(claimStatusText({ label: 'fabien', phase: 'available' })).toBe('fabien.stage.base.eth is available.');
    expect(claimStatusText({ label: 'fabien', phase: 'failed', detail: 'boom' })).toContain('boom');
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
