
import { describe, expect, test } from 'bun:test';
import { encodeJsonContent, decodeJsonContent } from '../src/xmtp/codecs';
import {
  SIGNATURE_REQUEST_CONTENT_TYPE, SIGNATURE_REFERENCE_CONTENT_TYPE,
  WALLET_SEND_CALLS_CONTENT_TYPE, TRANSACTION_REFERENCE_CONTENT_TYPE,
} from '../src/xmtp/codecs';
import { signatureRequestSchema, signatureReferenceSchema } from '../src/xmtp/sign.schema';
import { walletSendCallsSchema, transactionReferenceSchema } from '../src/xmtp/tx.schema';
import type { SignatureRequestContent } from '../src/xmtp/sign';
import type { WalletSendCallsContent } from '../src/xmtp/tx';

const permitTypedData = {
  domain: { name: 'Permit2', chainId: 1, verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3' },
  types: {
    PermitSingle: [
      { name: 'details', type: 'PermitDetails' },
      { name: 'spender', type: 'address' },
      { name: 'sigDeadline', type: 'uint256' },
    ],
  },
  primaryType: 'PermitSingle',
  message: { spender: '0xattacker', sigDeadline: '123' },
};

const validSigReq: SignatureRequestContent = {
  id: 'sig_1', kind: 'eip712', eip712: permitTypedData, description: 'Sign in',
};

describe('signatureRequestSchema', () => {
  test('valid eip712 request round-trips', () => {
    const enc = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, validSigReq);
    expect(decodeJsonContent(enc.content, signatureRequestSchema)).toEqual(validSigReq);
  });

  test('valid personal request round-trips', () => {
    const req: SignatureRequestContent = { id: 's', kind: 'personal', message: 'hello' };
    const enc = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, req);
    expect(decodeJsonContent(enc.content, signatureRequestSchema)).toEqual(req);
  });

  test('kind:eip712 with NO typed data is REJECTED', () => {
    const bad = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, { id: 's', kind: 'eip712' });
    expect(() => decodeJsonContent(bad.content, signatureRequestSchema)).toThrow();
  });

  test('kind:personal with NO message is REJECTED', () => {
    const bad = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, { id: 's', kind: 'personal' });
    expect(() => decodeJsonContent(bad.content, signatureRequestSchema)).toThrow();
  });

  test('unknown kind is REJECTED (bound to the two variants)', () => {
    const bad = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, { id: 's', kind: 'eth_sendTransaction', message: 'x' });
    expect(() => decodeJsonContent(bad.content, signatureRequestSchema)).toThrow();
  });

  test('eip712 missing the message/domain shape is REJECTED', () => {
    const bad = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, {
      id: 's', kind: 'eip712', eip712: { primaryType: 'X' },
    });
    expect(() => decodeJsonContent(bad.content, signatureRequestSchema)).toThrow();
  });

  test('a pathological blob (too many message keys) is REJECTED', () => {
    const message: Record<string, string> = {};
    for (let i = 0; i < 500; i++) message[`k${i}`] = 'v';
    const bad = encodeJsonContent(SIGNATURE_REQUEST_CONTENT_TYPE, {
      id: 's', kind: 'eip712', eip712: { ...permitTypedData, message },
    });
    expect(() => decodeJsonContent(bad.content, signatureRequestSchema)).toThrow();
  });
});

describe('signatureReferenceSchema', () => {
  test('valid receipt round-trips', () => {
    const ref = { requestId: 'sig_1', signature: '0xabc', signer: '0xdef' };
    const enc = encodeJsonContent(SIGNATURE_REFERENCE_CONTENT_TYPE, ref);
    expect(decodeJsonContent(enc.content, signatureReferenceSchema)).toEqual(ref);
  });
  test('missing signature is REJECTED', () => {
    const bad = encodeJsonContent(SIGNATURE_REFERENCE_CONTENT_TYPE, { requestId: 'x', signer: '0xy' });
    expect(() => decodeJsonContent(bad.content, signatureReferenceSchema)).toThrow();
  });
});

describe('walletSendCallsSchema', () => {
  const valid: WalletSendCallsContent = {
    version: '1.0', chainId: '0x1', from: '0xfrom',
    calls: [{ to: '0xto', value: '0x0', data: '0x' }],
  };
  test('valid request round-trips', () => {
    const enc = encodeJsonContent(WALLET_SEND_CALLS_CONTENT_TYPE, valid);
    expect(decodeJsonContent(enc.content, walletSendCallsSchema)).toEqual(valid);
  });
  test('empty calls[] is REJECTED', () => {
    const bad = encodeJsonContent(WALLET_SEND_CALLS_CONTENT_TYPE, { ...valid, calls: [] });
    expect(() => decodeJsonContent(bad.content, walletSendCallsSchema)).toThrow();
  });
  test('too many calls is REJECTED', () => {
    const calls = Array.from({ length: 100 }, () => ({ to: '0xto' }));
    const bad = encodeJsonContent(WALLET_SEND_CALLS_CONTENT_TYPE, { ...valid, calls });
    expect(() => decodeJsonContent(bad.content, walletSendCallsSchema)).toThrow();
  });
});

describe('transactionReferenceSchema', () => {
  test('valid receipt (numeric networkId) round-trips', () => {
    const ref = { networkId: 1, reference: '0xhash' };
    const enc = encodeJsonContent(TRANSACTION_REFERENCE_CONTENT_TYPE, ref);
    expect(decodeJsonContent(enc.content, transactionReferenceSchema)).toEqual(ref);
  });
  test('missing reference is REJECTED', () => {
    const bad = encodeJsonContent(TRANSACTION_REFERENCE_CONTENT_TYPE, { networkId: 1 });
    expect(() => decodeJsonContent(bad.content, transactionReferenceSchema)).toThrow();
  });
});
