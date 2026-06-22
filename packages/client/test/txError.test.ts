import { describe, expect, it } from 'bun:test';
import { friendlyTxError, txErrorMessage } from '../src/wallet/txError';

describe('friendlyTxError', () => {
  it('maps insufficient funds', () => {
    const e = new Error('The total cost (gas * gas fee + value) of executing this transaction exceeds the balance. insufficient funds. Version: viem@2.51.0');
    expect(friendlyTxError(e)).toBe('Insufficient funds for this transaction.');
  });

  it('maps user rejection', () => {
    expect(friendlyTxError(new Error('User rejected the request.'))).toBe('Request rejected.');
  });

  it('maps paymaster / AA3x', () => {
    expect(friendlyTxError(new Error('AA31 paymaster deposit too low')))
      .toBe('Gas sponsor declined this transaction (paymaster). It may be out of credit or this call is not allowed.');
  });

  it('maps AA21', () => {
    expect(friendlyTxError(new Error('AA21 didnt pay prefund')))
      .toBe('Gas sponsorship failed (account could not pay). Try again.');
  });

  it('maps signature errors', () => {
    expect(friendlyTxError(new Error('AA23 reverted (signature error)')))
      .toBe('Signature rejected by the account. Try again.');
  });

  it('maps nonce and timeout', () => {
    expect(friendlyTxError(new Error('nonce too low'))).toBe('Transaction nonce conflict. Try again.');
    expect(friendlyTxError(new Error('request timed out'))).toBe('The network timed out. Try again.');
  });

  it('prefers details over generic message and unwraps cause', () => {
    const e = { message: 'RPC Request failed.', cause: { details: 'insufficient funds for gas' } };
    expect(friendlyTxError(e)).toBe('Insufficient funds for this transaction.');
  });

  it('takes first line only and truncates long messages', () => {
    const msg = `${'x'.repeat(200)}\nsecond line`;
    const out = friendlyTxError(new Error(msg));
    expect(out.length).toBeLessThanOrEqual(140);
    expect(out.includes('\n')).toBe(false);
  });

  it('falls back when no message resolvable', () => {
    expect(friendlyTxError(undefined, 'Boom')).toBe('Boom');
    expect(friendlyTxError(null)).toBe('Transaction failed');
  });

  it('txErrorMessage requires explicit fallback (mobile parity)', () => {
    expect(txErrorMessage(undefined, 'Signing failed')).toBe('Signing failed');
  });
});
