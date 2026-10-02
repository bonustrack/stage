import { describe, expect, test } from 'bun:test';
import { encodeFunctionData, erc20Abi } from 'viem';
import { previewOfXmtpContent } from '../src/xmtp/humanize';
import type { WalletSendCallsContent } from '../src/xmtp/tx';

const USDC_BASE = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const UNKNOWN_TOKEN = '0x9999999999999999999999999999999999999999';
const PAYEE = '0x1111111111111111111111111111111111111111';
const PAYER = '0x2222222222222222222222222222222222222222';
const REQUEST = 'xmtp.org/walletSendCalls:1.0';
const RECEIPT = 'xmtp.org/transactionReference:1.0';

function request(call: WalletSendCallsContent['calls'][number]): WalletSendCallsContent {
  return { version: '1.0', chainId: '0x2105', from: PAYER, calls: [call] };
}

function transfer(token: string, raw: bigint): string {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [PAYEE, raw] });
}

describe('previewOfXmtpContent for payment requests', () => {
  test('native ETH: the amount comes from value, in ETH', () => {
    const req = request({ to: PAYEE, value: '0x2386f26fc10000', metadata: { currency: 'ETH', amount: 0.01, decimals: 18 } });
    expect(previewOfXmtpContent(req, REQUEST)).toBe('Payment request: 0.01 ETH');
  });

  test('known token: the amount comes from the transfer calldata with the token decimals', () => {
    const req = request({
      to: USDC_BASE, data: transfer(USDC_BASE, 10000n),
      metadata: { currency: 'USDC', amount: 10000, decimals: 6, toAddress: PAYEE },
    });
    expect(previewOfXmtpContent(req, REQUEST)).toBe('Payment request: 0.01 USDC');
  });

  test('unknown token: metadata amount scaled by its decimals', () => {
    const req = request({
      to: UNKNOWN_TOKEN, data: transfer(UNKNOWN_TOKEN, 10000n),
      metadata: { currency: 'FOO', amount: 10000, decimals: 6, toAddress: PAYEE },
    });
    expect(previewOfXmtpContent(req, REQUEST)).toBe('Payment request: 0.01 FOO');
  });

  test('metadata without decimals is shown as sent', () => {
    const req = request({ to: UNKNOWN_TOKEN, data: '0xdeadbeef', metadata: { currency: 'USDC', amount: 5 } });
    expect(previewOfXmtpContent(req, REQUEST)).toBe('Payment request: 5 USDC');
  });

  test('absurd decimals are not scaled', () => {
    const req = request({ to: UNKNOWN_TOKEN, data: '0xdeadbeef', metadata: { currency: 'FOO', amount: 1, decimals: 5e8 } });
    expect(previewOfXmtpContent(req, REQUEST)).toBe('Payment request: 1 FOO');
  });

  test('a bare call with no value shows the metadata amount or nothing, never 0 ETH', () => {
    expect(previewOfXmtpContent(request({ to: PAYEE }), REQUEST)).toBe('Payment request');
    expect(previewOfXmtpContent(request({ to: PAYEE, metadata: { currency: 'ETH', amount: 0.5 } }), REQUEST))
      .toBe('Payment request: 0.5 ETH');
  });

  test('no amount at all', () => {
    expect(previewOfXmtpContent(request({ to: UNKNOWN_TOKEN, data: '0xdeadbeef' }), REQUEST)).toBe('Payment request');
    expect(previewOfXmtpContent(null, REQUEST)).toBe('Payment request');
  });
});

describe('previewOfXmtpContent for receipts and signatures', () => {
  test('receipt with an amount reads like the bubble', () => {
    expect(previewOfXmtpContent({ networkId: 8453, reference: '0xabc', metadata: { currency: 'USDC', amount: 5 } }, RECEIPT))
      .toBe('Payment sent · 5 USDC');
    expect(previewOfXmtpContent({ networkId: 8453, reference: '0xabc', metadata: { currency: 'USDC', amount: 5000000, decimals: 6 } }, RECEIPT))
      .toBe('Payment sent · 5 USDC');
  });

  test('receipt without an amount', () => {
    expect(previewOfXmtpContent({ networkId: 8453, reference: '0xabc' }, RECEIPT)).toBe('Transaction sent');
  });

  test('signature request and signature', () => {
    expect(previewOfXmtpContent({ id: 's1', kind: 'personal', message: 'hi' }, 'metro.box/signatureRequest:1.0')).toBe('Signature request');
    expect(previewOfXmtpContent({ requestId: 's1', signature: '0x1', signer: PAYER }, 'metro.box/signatureReference:1.0')).toBe('Signed');
  });
});
