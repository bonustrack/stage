import { describe, expect, test } from 'bun:test';
import { AccountChangedError, accountScope, accountSelectionChanged, selectionScope } from '../lib/accountSelection';
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
});
