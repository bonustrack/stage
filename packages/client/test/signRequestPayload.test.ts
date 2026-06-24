
import { describe, expect, test } from 'bun:test';
import {
  typedDataForRequest, personalMessageForRequest, buildSignatureReference,
} from '../src/xmtp/sign';
import type { SignatureRequestContent } from '../src/xmtp/sign';

const eip712Req: SignatureRequestContent = {
  id: 'sig_1',
  kind: 'eip712',
  eip712: {
    domain: { name: 'Permit2', chainId: 1 },
    types: {
      EIP712Domain: [{ name: 'name', type: 'string' }],
      PermitSingle: [{ name: 'spender', type: 'address' }],
    },
    primaryType: 'PermitSingle',
    message: { spender: '0xabc' },
  },
};

describe('typedDataForRequest', () => {
  test('strips EIP712Domain and preserves domain/primaryType/message', () => {
    const td = typedDataForRequest(eip712Req);
    expect(td.types.EIP712Domain).toBeUndefined();
    expect(td.types.PermitSingle).toEqual([{ name: 'spender', type: 'address' }]);
    expect(td.primaryType).toBe('PermitSingle');
    expect(td.domain).toEqual({ name: 'Permit2', chainId: 1 });
    expect(td.message).toEqual({ spender: '0xabc' });
  });

  test('does not mutate the original request types', () => {
    typedDataForRequest(eip712Req);
    expect(eip712Req.eip712?.types.EIP712Domain).toBeDefined();
  });

  test('throws when typed data is missing', () => {
    expect(() => typedDataForRequest({ id: 's', kind: 'eip712' })).toThrow();
  });
});

describe('personalMessageForRequest', () => {
  test('returns the message string', () => {
    expect(personalMessageForRequest({ id: 's', kind: 'personal', message: 'hello' })).toBe('hello');
  });

  test('throws on empty message', () => {
    expect(() => personalMessageForRequest({ id: 's', kind: 'personal', message: '' })).toThrow();
    expect(() => personalMessageForRequest({ id: 's', kind: 'personal' })).toThrow();
  });
});

describe('buildSignatureReference', () => {
  test('builds a valid reference', () => {
    expect(buildSignatureReference('sig_1', '0xsig', '0xsigner')).toEqual({
      requestId: 'sig_1', signature: '0xsig', signer: '0xsigner',
    });
  });

  test('throws on missing fields', () => {
    expect(() => buildSignatureReference('', '0xsig', '0xsigner')).toThrow();
    expect(() => buildSignatureReference('sig_1', '', '0xsigner')).toThrow();
    expect(() => buildSignatureReference('sig_1', '0xsig', '')).toThrow();
  });
});
