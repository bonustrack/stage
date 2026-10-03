import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import {
  decodeFunctionData, encodeAbiParameters, keccak256, namehash, parseAbi, parseTransaction, stringToBytes, type Hex,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { makeNamesChain } from '../src/namesChain.ts';

const OPERATOR_KEY: Hex = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d';
const OPERATOR = privateKeyToAccount(OPERATOR_KEY).address;
const REGISTRY: Hex = '0xB94704422c2a1E396835A571837Aa5AE53285a95';
const RESOLVER: Hex = '0x426fA03fB86E510d0Dd9F70335Cf102a98b10875';
const USER: Hex = '0x00000000000000000000000000000000000000A1';
const ZERO: Hex = '0x0000000000000000000000000000000000000000';
const ABI = parseAbi([
  'function owner(bytes32 node) view returns (address)', 'function resolver(bytes32 node) view returns (address)',
  'function setSubnodeRecord(bytes32 node, bytes32 label, address owner, address resolver, uint64 ttl)',
]);

interface RpcCall { method: string; params: unknown[] }

const owners = new Map<Hex, Hex>();
const sent: Hex[] = [];

function readRegistry(data: Hex): Hex {
  const call = decodeFunctionData({ abi: ABI, data });
  const node = call.args[0];
  const answer = call.functionName === 'resolver' ? (node === namehash('stage.base.eth') ? RESOLVER : ZERO) : owners.get(node) ?? ZERO;
  return encodeAbiParameters([{ type: 'address' }], [answer]);
}

function answer({ method, params }: RpcCall): unknown {
  switch (method) {
    case 'eth_chainId': return '0x2105';
    case 'eth_call': return readRegistry((params[0] as { data: Hex }).data);
    case 'eth_getTransactionCount': return '0x0';
    case 'eth_estimateGas': return '0x12b0d';
    case 'eth_maxPriorityFeePerGas': return '0x1';
    case 'eth_blockNumber': return '0x10';
    case 'eth_getBlockByNumber': return { number: '0x10', baseFeePerGas: '0x1', hash: `0x${'1'.repeat(64)}`, transactions: [] };
    case 'eth_sendRawTransaction': sent.push(params[0] as Hex); return keccak256(params[0] as Hex);
    case 'eth_getTransactionReceipt': return { status: '0x1', blockNumber: '0x10', transactionHash: params[0], logs: [] };
    default: throw new Error(`unexpected ${method}`);
  }
}

beforeEach(() => {
  owners.clear();
  sent.length = 0;
  spyOn(globalThis, 'fetch').mockImplementation((async (_input: string | URL | Request, init?: RequestInit) => {
    const request = JSON.parse(String(init?.body)) as RpcCall & { id: number };
    return Response.json({ jsonrpc: '2.0', id: request.id, result: answer(request) });
  }) as typeof fetch);
});

afterEach(() => {
  (globalThis.fetch as unknown as { mockRestore(): void }).mockRestore();
});

function sentCalls(): { to: Hex | null | undefined; functionName: string; args: readonly unknown[] }[] {
  return sent.map((raw) => {
    const tx = parseTransaction(raw as `0x02${string}`);
    const call = decodeFunctionData({ abi: ABI, data: tx.data ?? '0x' });
    return { to: tx.to, functionName: call.functionName, args: call.args };
  });
}

describe('issuing a stage name on Base', () => {
  test('one transaction creates the name already owned by the claimer, on the parent resolver', async () => {
    const chain = makeNamesChain(OPERATOR_KEY, 'https://rpc.test/base');
    const hash = await chain.issue('fabien', USER);
    expect(hash).toBe(keccak256(sent[0] ?? '0x'));
    expect(sentCalls()).toEqual([{
      to: REGISTRY.toLowerCase() as Hex,
      functionName: 'setSubnodeRecord',
      args: [namehash('stage.base.eth'), keccak256(stringToBytes('fabien')), USER, RESOLVER, 0n],
    }]);
  });

  test('a name the operator still holds from an older claim goes to the claimer the same way', async () => {
    owners.set(namehash('fabien.stage.base.eth'), OPERATOR);
    await makeNamesChain(OPERATOR_KEY, 'https://rpc.test/base').issue('fabien', USER);
    expect(sentCalls().map((call) => [call.functionName, call.args[2]])).toEqual([['setSubnodeRecord', USER]]);
  });

  test('a name someone else owns is refused before any transaction', async () => {
    owners.set(namehash('fabien.stage.base.eth'), '0x00000000000000000000000000000000000000b2');
    await expect(makeNamesChain(OPERATOR_KEY, 'https://rpc.test/base').issue('fabien', USER)).rejects.toThrow('name already taken');
    expect(sent).toEqual([]);
  });
});
