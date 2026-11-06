import { describe, expect, test } from 'bun:test';
import { AccountChangedError, accountScope, accountSelectionChanged, selectionScope, withAccountScope } from '../lib/accountSelection';
import { bumpAccountEpoch } from '../lib/accountEpoch';

describe('account scopes', () => {
  test('a selection scope outlives a client reset but not an account switch', () => {
    const scope = selectionScope();
    bumpAccountEpoch();
    expect(scope.current()).toBe(true);
    accountSelectionChanged();
    expect(scope.current()).toBe(false);
    expect(() => {
      scope.assertCurrent('The account changed while saving your profile.');
    }).toThrow(new AccountChangedError('The account changed while saving your profile.'));
  });

  test('an account scope ends with the client generation too', () => {
    const scope = accountScope();
    expect(scope.current()).toBe(true);
    bumpAccountEpoch();
    expect(scope.current()).toBe(false);
    expect(() => {
      scope.assertCurrent();
    }).toThrow(AccountChangedError);
  });

  test('a signalled scope aborts on a switch or a client reset and stops listening when the work ends', async () => {
    for (const change of [bumpAccountEpoch, accountSelectionChanged]) {
      const signals: AbortSignal[] = [];
      await withAccountScope(async (scope) => {
        signals.push(scope.signal);
        expect(scope.signal.aborted).toBe(false);
        change();
        expect(scope.signal.aborted).toBe(true);
        expect(scope.current()).toBe(false);
      });
      const idle = await withAccountScope(async (scope) => scope.signal);
      change();
      expect(idle.aborted).toBe(false);
      expect(signals).toHaveLength(1);
    }
  });
});
