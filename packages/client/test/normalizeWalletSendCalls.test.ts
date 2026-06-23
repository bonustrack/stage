import { describe, expect, it } from 'bun:test';
import { normalizeWalletSendCalls } from '../src/xmtp/tx';
import type { WalletSendCallsContent } from '../src/xmtp/tx';

const TO = '0x1111111111111111111111111111111111111111';

function content(calls: WalletSendCallsContent['calls'], chainId = '0x2105'): WalletSendCallsContent {
  return { version: '1.0', chainId, from: TO, calls };
}

describe('normalizeWalletSendCalls', () => {
  it('normalizes a single hex-value call on Base', () => {
    const out = normalizeWalletSendCalls(content([{ to: TO, value: '0x0' }]));
    expect(out.chainId).toBe(8453);
    expect(out.calls).toEqual([{ to: TO, value: 0n }]);
  });

  it('parses decimal chainId and hex value, keeps data', () => {
    const out = normalizeWalletSendCalls(content([{ to: TO, value: '0x10', data: '0xabcd' }], '8453'));
    expect(out.chainId).toBe(8453);
    expect(out.calls[0]).toEqual({ to: TO, value: 16n, data: '0xabcd' });
  });

  it('normalizes a batch of calls', () => {
    const out = normalizeWalletSendCalls(content([
      { to: TO, value: '0x1' },
      { to: TO, value: '0x2', data: '0x' },
    ]));
    expect(out.calls.length).toBe(2);
  });

  it('defaults missing value to 0', () => {
    const out = normalizeWalletSendCalls(content([{ to: TO }]));
    expect(out.calls[0]?.value).toBe(0n);
  });

  it('rejects an invalid recipient', () => {
    expect(() => normalizeWalletSendCalls(content([{ to: '0x123', value: '0x0' }]))).toThrow();
  });

  it('rejects invalid call data', () => {
    expect(() => normalizeWalletSendCalls(content([{ to: TO, data: 'nothex' }]))).toThrow();
  });

  it('rejects empty calls', () => {
    expect(() => normalizeWalletSendCalls(content([]))).toThrow();
  });
});
