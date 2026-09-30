import { describe, expect, test } from 'bun:test';
import { protectionSteps, protectionTitle } from '../components/settings/protection.model';

describe('protection', () => {
  test('a smart account only needs its phrase backed up', () => {
    const steps = protectionSteps({ isSmart: true, backedUp: false, canExportKey: false });
    expect(steps.map((s) => [s.id, s.done])).toEqual([['phrase', false]]);
    expect(protectionTitle(steps)).toBe('0 of 1 steps to protect your account');
  });

  test('a saved phrase reads as protected, unknown backup counts as not done', () => {
    expect(protectionTitle(protectionSteps({ isSmart: true, backedUp: true, canExportKey: false }))).toBe('Your account is protected');
    expect(protectionSteps({ isSmart: true, backedUp: null, canExportKey: false }).every((s) => !s.done)).toBe(true);
  });

  test('a key account only asks to save its key, when it can', () => {
    expect(protectionSteps({ isSmart: false, backedUp: null, canExportKey: true }).map((s) => s.id)).toEqual(['key']);
    expect(protectionSteps({ isSmart: false, backedUp: null, canExportKey: false })).toEqual([]);
    expect(protectionTitle([])).toBe('Your account');
  });
});
