/** Tests for the in-chat SIGNATURE confirm/risk-decode (audit HIGH/#1).
 *
 *  The confirm sheet for a signature request must surface an explicit warning
 *  for a high-risk typed-data primaryType (Permit/Permit2/EIP-3009/Seaport),
 *  decode the empowered spender from the typed-data STRUCTURE, and NEVER present
 *  the peer-supplied `description` as the trusted summary. */

import { describe, expect, test } from 'bun:test';
import { deriveSignSummary, signConfirmMessage } from '../lib/signConfirm';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

const SPENDER = '0xAttackerSpender0000000000000000000000001';
const PERMIT2 = '0x000000000022D473030F116dDEE9F6B43aC78BA3';

function permit2Request(description?: string): SignatureRequestContent {
  return {
    id: 'sig_1',
    kind: 'eip712',
    description,
    eip712: {
      domain: { name: 'Permit2', chainId: 1, verifyingContract: PERMIT2 },
      types: {
        PermitSingle: [
          { name: 'spender', type: 'address' },
          { name: 'sigDeadline', type: 'uint256' },
        ],
      },
      primaryType: 'PermitSingle',
      message: { spender: SPENDER, sigDeadline: '1700000000' },
    },
  };
}

describe('deriveSignSummary - high-risk typed data', () => {
  test('Permit2 PermitSingle is flagged high-risk + decodes the spender', () => {
    const s = deriveSignSummary(permit2Request());
    expect(s.highRisk).toBe(true);
    expect(s.kindLabel).toMatch(/Permit2/);
    expect(s.counterparty).toBe(SPENDER);
    expect(s.token).toBe(PERMIT2);
    expect(s.domainName).toBe('Permit2');
    expect(s.chainId).toBe('1');
  });

  test('EIP-3009 TransferWithAuthorization is high-risk, decodes `to`', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: {
        domain: { name: 'USD Coin' },
        types: { TransferWithAuthorization: [{ name: 'to', type: 'address' }] },
        primaryType: 'TransferWithAuthorization',
        message: { to: SPENDER },
      },
    };
    const s = deriveSignSummary(req);
    expect(s.highRisk).toBe(true);
    expect(s.counterparty).toBe(SPENDER);
  });

  test('Seaport OrderComponents is high-risk', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: { domain: {}, types: { OrderComponents: [] }, primaryType: 'OrderComponents', message: {} },
    };
    expect(deriveSignSummary(req).highRisk).toBe(true);
  });
});

describe('deriveSignSummary - low-risk', () => {
  test('a plain personal-sign message is not high-risk', () => {
    const s = deriveSignSummary({ id: 's', kind: 'personal', message: 'gm' });
    expect(s.highRisk).toBe(false);
    expect(s.kindLabel).toBe('message');
  });
  test('an unknown benign typed-data primaryType is not high-risk', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: { domain: {}, types: { Login: [] }, primaryType: 'Login', message: {} },
    };
    expect(deriveSignSummary(req).highRisk).toBe(false);
  });
});

describe('signConfirmMessage - never trusts description', () => {
  test('high-risk message warns + names the spender, NOT the description as summary', () => {
    const s = deriveSignSummary(permit2Request('Sign in to claim your airdrop'));
    const msg = signConfirmMessage(s, 'Sign in to claim your airdrop');
    // The trusted summary names the real authorization + spender.
    expect(msg).toMatch(/⚠️|grants/i);
    expect(msg).toMatch(/Permit2/);
    expect(msg).toContain(SPENDER);
    // The phishing description is present ONLY behind an "untrusted" label.
    expect(msg).toMatch(/untrusted/i);
    expect(msg).toContain('Sign in to claim your airdrop');
    // It must NOT lead with the phishing text as the headline.
    expect(msg.startsWith('Sign in to claim')).toBe(false);
  });

  test('low-risk confirm is neutral + still marks the sender note untrusted', () => {
    const s = deriveSignSummary({ id: 's', kind: 'personal', message: 'gm' });
    const msg = signConfirmMessage(s, 'totally safe trust me');
    expect(msg).toMatch(/Sign a message/);
    expect(msg).toMatch(/untrusted/i);
  });
});
