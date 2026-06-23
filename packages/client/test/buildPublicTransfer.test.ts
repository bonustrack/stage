import { describe, expect, it } from 'bun:test';
import { buildPublicTransfer, normalizeWalletSendCalls } from '../src/xmtp/tx';

const FROM = '0x2222222222222222222222222222222222222222';
const TO = '0x1111111111111111111111111111111111111111';

describe('buildPublicTransfer', () => {
  it('builds a 1.0 walletSendCalls ETH transfer on mainnet', () => {
    const c = buildPublicTransfer({ from: FROM, to: TO, amount: '1.5' });
    expect(c.version).toBe('1.0');
    expect(c.chainId).toBe('0x1');
    expect(c.from).toBe(FROM);
    expect(c.calls).toHaveLength(1);
    const [call] = c.calls;
    expect(call?.to).toBe(TO);
    expect(call?.value).toBe('0x14d1120d7b160000');
    expect(call?.metadata).toMatchObject({
      transactionType: 'transfer', currency: 'ETH', amount: 1.5, decimals: 18, toAddress: TO,
      description: 'Send 1.5 ETH',
    });
  });

  it('uses the note as the description when provided', () => {
    const c = buildPublicTransfer({ from: FROM, to: TO, amount: '2', note: 'Lunch' });
    const [call] = c.calls;
    expect(call?.metadata?.description).toBe('Lunch');
  });

  it('produces content that round-trips through normalizeWalletSendCalls', () => {
    const c = buildPublicTransfer({ from: FROM, to: TO, amount: '0.25' });
    const out = normalizeWalletSendCalls(c);
    expect(out.chainId).toBe(1);
    const [call] = out.calls;
    expect(call?.to).toBe(TO);
    expect(call?.value).toBe(250000000000000000n);
  });

  it('rejects an invalid recipient', () => {
    expect(() => buildPublicTransfer({ from: FROM, to: 'nope', amount: '1' })).toThrow('recipient');
  });

  it('rejects an invalid sender', () => {
    expect(() => buildPublicTransfer({ from: 'nope', to: TO, amount: '1' })).toThrow('sender');
  });

  it('rejects a non-positive amount', () => {
    expect(() => buildPublicTransfer({ from: FROM, to: TO, amount: '0' })).toThrow('amount');
    expect(() => buildPublicTransfer({ from: FROM, to: TO, amount: 'x' })).toThrow('amount');
  });
});
