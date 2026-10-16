import { describe, expect, test } from 'bun:test';
import type { PublicClient } from 'viem';
import { baseReverseNode, inspectNameSetup } from '../src/identity/onchainProfile';

const ADDRESS = '0x00000000000000000000000000000000000000a1';
const OTHER = '0x00000000000000000000000000000000000000a2';
const ZERO = '0x0000000000000000000000000000000000000000';
const RESOLVER = '0x00000000000000000000000000000000000000c0';
const NAME = 'synthetic123.stage.base.eth';
const RECORDS = { avatar: 'ipfs://synthetic', name: 'Synthetic', description: 'Offline test' };

function harness(patch: { owner?: string; resolver?: string; reverseResolver?: string; forward?: string; primary?: string; records?: Record<string, string>; fail?: boolean } = {}) {
  const blocks: (bigint | undefined)[] = [];
  const answers: Record<string, string> = { owner: patch.owner ?? ADDRESS, addr: patch.forward ?? ADDRESS, name: patch.primary ?? NAME };
  const texts = patch.records ?? RECORDS;
  const resolver = patch.resolver ?? RESOLVER;
  const reverseResolver = patch.reverseResolver ?? RESOLVER;
  const client = {
    getBlockNumber: () => Promise.resolve(99n),
    readContract: async ({ functionName, args, blockNumber }: { functionName: string; args: unknown[]; blockNumber?: bigint }) => {
      if (patch.fail) throw new Error('rpc unavailable');
      blocks.push(blockNumber);
      if (functionName === 'resolver') return args[0] === baseReverseNode(ADDRESS) ? reverseResolver : resolver;
      if (functionName === 'text') return texts[String(args[1])] ?? '';
      return answers[functionName] ?? '';
    },
  } as unknown as PublicClient;
  return { client, blocks };
}

describe('authoritative setup confirmation', () => {
  test('pins forward, reverse and every requested text record to one fresh block', async () => {
    const h = harness();
    expect(await inspectNameSetup(h.client, ADDRESS, NAME, RECORDS)).toEqual({ owned: true, ready: true });
    expect(h.blocks.length).toBeGreaterThanOrEqual(8);
    expect(h.blocks.every(block => block === 99n)).toBe(true);
  });
  for (const patch of [{ resolver: ZERO }, { reverseResolver: ZERO }, { forward: OTHER }, { primary: 'other123.stage.base.eth' }, { records: { ...RECORDS, avatar: 'ipfs://old' } }]) {
    test(`missing or mismatched records cannot finish setup ${JSON.stringify(patch)}`, async () => {
      expect(await inspectNameSetup(harness(patch).client, ADDRESS, NAME, RECORDS)).toEqual({ owned: true, ready: false });
    });
  }
  test('a different registry owner is not treated as ownership', async () => {
    expect(await inspectNameSetup(harness({ owner: OTHER }).client, ADDRESS, NAME, RECORDS)).toEqual({ owned: false, ready: false });
  });
  test('an RPC failure remains an error, never a permission to write', async () => {
    await expect(inspectNameSetup(harness({ fail: true }).client, ADDRESS, NAME, RECORDS)).rejects.toThrow('rpc unavailable');
  });
});
