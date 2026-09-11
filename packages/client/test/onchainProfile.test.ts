import { describe, expect, test } from 'bun:test';
import {
  baseCoinType, baseReverseNode, isBasename, resolveBasenameProfile, resolveOnchainProfile, usableAvatarUri,
} from '../src/identity/onchainProfile';
import type { PublicClient } from 'viem';

const ALICE = '0x00000000000000000000000000000000000000A1';

describe('basename reverse nodes', () => {
  test('encodes the Base chain id as ENSIP-11 coin type', () => {
    expect(baseCoinType(8453)).toBe('80002105');
  });

  test('matches the reverse node OnchainKit derives for a known address', () => {
    expect(baseReverseNode('0x8c8F1a1e1bFdb15E7ed562efc84e5A588E68aD73'))
      .toBe('0xcd18b9f82b690bdf732816fe0b9796635191f97e59bcebbef4eba6e05a39da05');
  });

  test('is deterministic and case-insensitive on the address', () => {
    expect(baseReverseNode(ALICE)).toBe(baseReverseNode(ALICE.toLowerCase()));
    expect(baseReverseNode(ALICE)).toMatch(/^0x[0-9a-f]{64}$/);
    expect(baseReverseNode(ALICE)).not.toBe(baseReverseNode('0x00000000000000000000000000000000000000A2'));
  });
});

describe('avatar and name helpers', () => {
  test('recognises basenames', () => {
    expect(isBasename('tony.base.eth')).toBe(true);
    expect(isBasename('tony.eth')).toBe(false);
  });

  test('keeps only fetchable avatar URIs', () => {
    expect(usableAvatarUri(' https://x/y.png ')).toBe('https://x/y.png');
    expect(usableAvatarUri('ipfs://bafy')).toBe('ipfs://bafy');
    expect(usableAvatarUri('eip155:1/erc721:0xabc/1')).toBeUndefined();
    expect(usableAvatarUri(null)).toBeUndefined();
  });
});

function fakeClient(answers: { name: string; addr: string; text?: string }, fail = false): PublicClient {
  return {
    readContract: async ({ functionName }: { functionName: string }) => {
      if (fail) throw new Error('rpc down');
      if (functionName === 'name') return answers.name;
      if (functionName === 'addr') return answers.addr;
      return answers.text ?? '';
    },
    getEnsName: async () => { throw new Error('no mainnet'); },
  } as unknown as PublicClient;
}

describe('resolveBasenameProfile', () => {
  test('returns the basename and avatar when forward resolution matches', async () => {
    const client = fakeClient({ name: 'tony.base.eth', addr: ALICE, text: 'ipfs://pic' });
    expect(await resolveBasenameProfile(client, ALICE)).toEqual({ name: 'tony.base.eth', avatar: 'ipfs://pic', source: 'basename' });
  });

  test('rejects a reverse record that does not resolve back to the address', async () => {
    const client = fakeClient({ name: 'tony.base.eth', addr: '0x00000000000000000000000000000000000000B2' });
    expect(await resolveBasenameProfile(client, ALICE)).toBeNull();
  });

  test('falls back from ENS to basenames and swallows RPC failures', async () => {
    const clients = { mainnet: fakeClient({ name: '', addr: '' }), base: fakeClient({ name: 'tony.base.eth', addr: ALICE }) };
    expect(await resolveOnchainProfile(clients, ALICE)).toEqual({ name: 'tony.base.eth', avatar: undefined, source: 'basename' });
    const broken = { mainnet: fakeClient({ name: '', addr: '' }, true), base: fakeClient({ name: '', addr: '' }, true) };
    expect(await resolveOnchainProfile(broken, ALICE)).toBeNull();
  });
});
