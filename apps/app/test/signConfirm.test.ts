/** Tests for the in-chat SIGNATURE confirm/risk-decode (audit HIGH/#1).
 *
 *  The confirm sheet for a signature request must surface an explicit warning
 *  for a high-risk typed-data primaryType (Permit/Permit2/EIP-3009/Seaport),
 *  decode the empowered spender from the typed-data STRUCTURE, and NEVER present
 *  the peer-supplied `description` as the trusted summary. */

import { describe, expect, test } from 'bun:test';
import { deriveSignSummary, signConfirmMessage, normalizeChainId } from '../lib/signConfirm';
import type { SignatureRequestContent } from '@stage-labs/client/xmtp/sign';

/** The chain a smart (ZeroDev Kernel) account actually settles/signs on. */
const BASE = 8453;

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

/** Build a typed-data request with an arbitrary `domain.chainId` (number, hex,
 *  or decimal string) to exercise the chain-mismatch defense. */
function permitOnChain(chainId: number | string): SignatureRequestContent {
  return {
    id: 'sig_c', kind: 'eip712',
    eip712: {
      domain: { name: 'Permit2', chainId, verifyingContract: PERMIT2 },
      types: { PermitSingle: [{ name: 'spender', type: 'address' }] },
      primaryType: 'PermitSingle',
      message: { spender: SPENDER },
    },
  };
}

describe('normalizeChainId', () => {
  test('parses number, decimal string, and 0x-hex string identically', () => {
    expect(normalizeChainId(1)).toBe(1n);
    expect(normalizeChainId('1')).toBe(1n);
    expect(normalizeChainId('0x1')).toBe(1n);
    expect(normalizeChainId(8453)).toBe(8453n);
    expect(normalizeChainId('0x2105')).toBe(8453n); // 0x2105 === 8453 (Base)
  });
  test('returns undefined for absent / unparseable values', () => {
    expect(normalizeChainId(undefined)).toBeUndefined();
    expect(normalizeChainId(null)).toBeUndefined();
    expect(normalizeChainId('')).toBeUndefined();
    expect(normalizeChainId('nope')).toBeUndefined();
  });
});

describe('deriveSignSummary - cross-chain replay (EIP-712 domain.chainId)', () => {
  // SECURITY: a smart account ALWAYS settles on Base, but kernel.signTypedData
  // signs whatever domain.chainId the untrusted peer chose. A signature is bound
  // to its domain chainId, so a mismatch = a signature replayable on the
  // attacker's chain. The summary MUST flag this as high-risk.
  test('mainnet (1) Permit2 while the wallet signs on Base (8453) is a chain mismatch + high-risk', () => {
    const s = deriveSignSummary(permitOnChain(1), BASE);
    expect(s.chainMismatch).toBe(true);
    expect(s.highRisk).toBe(true);
    expect(s.chainId).toBe('1');
    expect(s.expectedChainId).toBe('8453');
  });

  test('hex-encoded mismatched chainId is still caught (no encoding bypass)', () => {
    const s = deriveSignSummary(permitOnChain('0x1'), BASE); // chain 1 as hex
    expect(s.chainMismatch).toBe(true);
    expect(s.highRisk).toBe(true);
  });

  test('a benign (non-allowance) primaryType on the WRONG chain is still high-risk', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: { domain: { name: 'App', chainId: 1 }, types: { Login: [] }, primaryType: 'Login', message: {} },
    };
    const s = deriveSignSummary(req, BASE);
    expect(s.chainMismatch).toBe(true);
    expect(s.highRisk).toBe(true); // chain mismatch alone forces high-risk
  });

  test('MATCHING chain (Base request, Base wallet) is NOT a mismatch', () => {
    const s = deriveSignSummary(permitOnChain(BASE), BASE);
    expect(s.chainMismatch).toBeUndefined();
    // still high-risk because Permit2 is inherently high-risk, but NOT for chain.
    expect(s.highRisk).toBe(true);
  });

  test('matching chain on a benign primaryType is fully low-risk', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: { domain: { name: 'App', chainId: BASE }, types: { Login: [] }, primaryType: 'Login', message: {} },
    };
    const s = deriveSignSummary(req, BASE);
    expect(s.chainMismatch).toBeUndefined();
    expect(s.highRisk).toBe(false);
  });

  test('no expectedChainId supplied (legacy EOA) => never flags a mismatch', () => {
    const s = deriveSignSummary(permitOnChain(1));
    expect(s.chainMismatch).toBeUndefined();
  });

  test('request omits chainId => no false-positive mismatch', () => {
    const req: SignatureRequestContent = {
      id: 's', kind: 'eip712',
      eip712: { domain: { name: 'App' }, types: { Login: [] }, primaryType: 'Login', message: {} },
    };
    expect(deriveSignSummary(req, BASE).chainMismatch).toBeUndefined();
  });

  test('a personal_sign is never affected by expectedChainId', () => {
    const s = deriveSignSummary({ id: 's', kind: 'personal', message: 'gm' }, BASE);
    expect(s.chainMismatch).toBeUndefined();
    expect(s.highRisk).toBe(false);
  });
});

describe('signConfirmMessage - chain mismatch is a headline warning', () => {
  test('names both chains and warns about replay', () => {
    const s = deriveSignSummary(permitOnChain(1), BASE);
    const msg = signConfirmMessage(s);
    expect(msg).toMatch(/chain mismatch/i);
    expect(msg).toContain('chain 1');
    expect(msg).toContain('chain 8453');
    expect(msg).toMatch(/⚠️/);
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

  test('low-risk confirm shows the concrete message + marks the sender note untrusted', () => {
    const s = deriveSignSummary({ id: 's', kind: 'personal', message: 'gm' });
    const msg = signConfirmMessage(s, 'totally safe trust me');
    expect(msg).toMatch(/Sign this message/);
    expect(msg).toMatch(/"gm"/); // the literal content being signed, not just a label
    expect(msg).toMatch(/untrusted/i);
  });
});
