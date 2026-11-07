import { describe, expect, test } from 'bun:test';
import { isTransferRequest, txActionLabel } from '../src/wallet/txWording';
import type { DecodedCall } from '../src/wallet/txDecode';

const call = (functionName: string, args: DecodedCall['args'] = []): DecodedCall => ({
  decoded: true,
  verified: true,
  source: 'sourcify',
  functionName,
  signature: `${functionName}()`,
  args,
});

describe('isTransferRequest', () => {
  test('no decoded call (plain native ETH transfer) -> transfer', () => {
    expect(isTransferRequest(null, false)).toBe(true);
  });
  test('ERC-20 transfer (metadata.toAddress) -> transfer', () => {
    expect(isTransferRequest(null, true)).toBe(true);
  });
  test('decoded transfer() -> transfer', () => {
    expect(isTransferRequest(call('transfer'), false)).toBe(true);
  });
  test('decoded post() -> contract call', () => {
    expect(isTransferRequest(call('post'), false)).toBe(false);
  });
});

describe('txActionLabel', () => {
  test('transfer -> Pay', () => {
    expect(txActionLabel(call('transfer'), false)).toBe('Pay');
  });
  test('native transfer (no call) -> Pay', () => {
    expect(txActionLabel(null, false)).toBe('Pay');
  });
  test('Poster post(string,string) -> Post message', () => {
    const c = call('post', [
      { name: 'content', type: 'string', value: 'Hello from Stage' },
      { name: 'tag', type: 'string', value: 'stage' },
    ]);
    expect(txActionLabel(c, false)).toBe('Post message');
  });
  test('known contract actions read in plain words', () => {
    expect(txActionLabel(call('approve'), false)).toBe('Approve');
    expect(txActionLabel(call('setApprovalForAll'), false)).toBe('Approve collection');
  });
  test('other function names are split into a sentence', () => {
    expect(txActionLabel(call('swapExactTokensForETH'), false)).toBe('Swap exact tokens for eth');
    expect(txActionLabel(call('add_liquidity'), false)).toBe('Add liquidity');
  });
  test('unknown contract call -> Confirm', () => {
    expect(txActionLabel({ decoded: true, verified: false, source: '4byte', args: [] }, false)).toBe('Confirm');
  });
});
