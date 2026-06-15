/** Tx-request card wording: transfer vs contract-call action labels + the
 *  humanizer. Pure, no network — mirrors what TxRequestCard renders. */
import { describe, expect, test } from 'bun:test';
import {
  isTransferRequest, humanizeAction, txActionLabel,
} from '../components/MessengerBubble.txwording';
import type { DecodedCall } from '../lib/txDecode';

const call = (functionName: string, args: DecodedCall['args'] = []): DecodedCall => ({
  decoded: true, verified: true, source: 'sourcify', functionName,
  signature: `${functionName}()`, args,
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

describe('humanizeAction', () => {
  test('post -> Post message', () => { expect(humanizeAction(call('post'))).toBe('Post message'); });
  test('approve -> Approve', () => { expect(humanizeAction(call('approve'))).toBe('Approve'); });
  test('camelCase split + sentence-case', () => {
    expect(humanizeAction(call('swapExactTokensForETH'))).toBe('Swap exact tokens for eth');
  });
  test('no decoded name -> Confirm', () => { expect(humanizeAction(null)).toBe('Confirm'); });
});

describe('txActionLabel', () => {
  test('transfer -> Pay', () => { expect(txActionLabel(call('transfer'), false)).toBe('Pay'); });
  test('native transfer (no call) -> Pay', () => { expect(txActionLabel(null, false)).toBe('Pay'); });
  test('Poster post(string,string) -> Post message', () => {
    const c = call('post', [
      { name: 'content', type: 'string', value: 'Hello from Metro' },
      { name: 'tag', type: 'string', value: 'metro' },
    ]);
    expect(txActionLabel(c, false)).toBe('Post message');
  });
  test('unknown contract call -> Confirm', () => {
    expect(txActionLabel({ decoded: true, verified: false, source: '4byte', args: [] }, false)).toBe('Confirm');
  });
});
