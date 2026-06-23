import { describe, expect, it } from 'bun:test';
import {
  buildPersonalSignatureRequest, buildEip712SignatureRequest,
  personalMessageForRequest, typedDataForRequest,
} from '../src/xmtp/sign';

describe('buildPersonalSignatureRequest', () => {
  it('builds a personal request with an id and trimmed message', () => {
    const c = buildPersonalSignatureRequest('  Hello  ', 'Sign in');
    expect(c.kind).toBe('personal');
    expect(c.id).toBeTruthy();
    expect(c.message).toBe('Hello');
    expect(c.description).toBe('Sign in');
    expect(personalMessageForRequest(c)).toBe('Hello');
  });

  it('omits an empty description', () => {
    const c = buildPersonalSignatureRequest('Hello', '   ');
    expect(c.description).toBeUndefined();
  });

  it('rejects an empty message', () => {
    expect(() => buildPersonalSignatureRequest('   ')).toThrow('message');
  });
});

describe('buildEip712SignatureRequest', () => {
  const valid = JSON.stringify({
    domain: { name: 'Mail' },
    types: { Mail: [{ name: 'contents', type: 'string' }] },
    primaryType: 'Mail',
    message: { contents: 'Hello' },
  });

  it('builds an eip712 request from valid JSON', () => {
    const c = buildEip712SignatureRequest(valid, 'Approve');
    expect(c.kind).toBe('eip712');
    expect(c.id).toBeTruthy();
    expect(c.description).toBe('Approve');
    expect(c.eip712?.primaryType).toBe('Mail');
    const td = typedDataForRequest(c);
    expect(td.primaryType).toBe('Mail');
    expect(td.message).toEqual({ contents: 'Hello' });
  });

  it('rejects invalid JSON', () => {
    expect(() => buildEip712SignatureRequest('{ not json')).toThrow('valid JSON');
  });

  it('rejects JSON missing required typed-data fields', () => {
    expect(() => buildEip712SignatureRequest(JSON.stringify({ types: {} }))).toThrow('primaryType');
  });
});
