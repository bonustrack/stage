import { describe, expect, test } from 'bun:test';
import { protectionSteps, protectionTitle } from '../components/settings/protection.model';

describe('protection', () => {
  test('a smart account has two steps, phrase then passkey', () => {
    const steps = protectionSteps({ isSmart: true, backedUp: false, passkeyOn: true, canExportKey: false });
    expect(steps.map((s) => [s.id, s.done])).toEqual([['phrase', false], ['passkey', true]]);
    expect(protectionTitle(steps)).toBe('1 of 2 steps to protect your account');
  });

  test('all done reads as protected, unknown backup counts as not done', () => {
    expect(protectionTitle(protectionSteps({ isSmart: true, backedUp: true, passkeyOn: true, canExportKey: false }))).toBe('Your account is protected');
    expect(protectionSteps({ isSmart: true, backedUp: null, passkeyOn: false, canExportKey: false }).every((s) => !s.done)).toBe(true);
  });

  test('a key account only asks to save its key, when it can', () => {
    expect(protectionSteps({ isSmart: false, backedUp: null, passkeyOn: false, canExportKey: true }).map((s) => s.id)).toEqual(['key']);
    expect(protectionSteps({ isSmart: false, backedUp: null, passkeyOn: false, canExportKey: false })).toEqual([]);
    expect(protectionTitle([])).toBe('Your account');
  });
});
