import { describe, expect, test } from 'bun:test';
import { sendTokenFor } from '../components/wallet/TokenSelector.model';

describe('sendTokenFor', () => {
  test('defaults to ETH on Base', () => {
    expect(sendTokenFor()).toEqual({ symbol: 'ETH', chainId: 8453 });
  });

  test('keeps USDC on Base when the link asks for it', () => {
    expect(sendTokenFor('USDC')).toEqual({ symbol: 'USDC', chainId: 8453 });
    expect(sendTokenFor('USDC', '8453')).toEqual({ symbol: 'USDC', chainId: 8453 });
  });

  test('falls back to ETH on Base for a token or chain the wallet does not hold', () => {
    expect(sendTokenFor('USDC', '1')).toEqual({ symbol: 'ETH', chainId: 8453 });
    expect(sendTokenFor('STAGE', '11155111')).toEqual({ symbol: 'ETH', chainId: 8453 });
    expect(sendTokenFor('DAI')).toEqual({ symbol: 'ETH', chainId: 8453 });
  });
});
