import { afterEach, describe, expect, test } from 'bun:test';
import { encodeAbiParameters } from 'viem';
import { simulateTx, type SimCall } from '../src/wallet/txSimulate';
import { fakeFetch } from './helpers';

const BASE = 8453;
const USDC = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
const ME = '0x20FE51A9229EEf2cF8Ad9E89d91CAb9312cF3b7A';
const PEER = '0x0000000000000000000000000000000000000abc';
const TRANSFER = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ONE_ETH = '0xde0b6b3a7640000';
const CALLDATA = '0xa9059cbb';

const topic = (a: string): string => '0x' + a.toLowerCase().replace(/^0x/, '').padStart(64, '0');
const u256 = (n: bigint): string => '0x' + n.toString(16).padStart(64, '0');
const errorString = (reason: string): string => '0x08c379a0' + encodeAbiParameters([{ type: 'string' }], [reason]).slice(2);
const transferLog = (from: string, to: string, amount: bigint, token = USDC) => ({
  address: token,
  topics: [TRANSFER, topic(from), topic(to)],
  data: u256(amount),
});

interface RpcAnswers {
  balance?: string;
  simulate?: { calls: SimCall[] } | { error: string };
  call?: { error: { message?: string; data?: string } };
}

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function answerRpc(answers: RpcAnswers): string[] {
  const methods: string[] = [];
  globalThis.fetch = fakeFetch(async (_input, init) => {
    const { method } = JSON.parse(String(init?.body)) as { method: string };
    methods.push(method);
    const sim = answers.simulate;
    if (method === 'eth_getBalance') return Response.json({ result: answers.balance ?? '0x0' });
    if (method === 'eth_simulateV1' && sim !== undefined) {
      return Response.json('error' in sim ? { error: { message: sim.error } } : { result: [{ calls: sim.calls }] });
    }
    if (method === 'eth_call') return Response.json(answers.call ?? { result: '0x' });
    return Response.json({ error: { message: `unexpected ${method}` } });
  });
  return methods;
}

const simulate = (value: string, data?: string) => simulateTx({ from: ME, to: PEER, value, chainId: BASE, ...(data ? { data } : {}) });

describe('simulateTx balance changes', () => {
  test('an ERC-20 transfer out shows the amount leaving in the token units', async () => {
    answerRpc({ simulate: { calls: [{ status: '0x1', logs: [transferLog(ME, PEER, 1_500_000n)] }] } });
    const result = await simulate('0x0', CALLDATA);
    expect(result.success).toBe(true);
    expect(result.assetChanges.in).toEqual([]);
    expect(result.assetChanges.out).toEqual([{ token: USDC.toLowerCase(), symbol: 'USDC', amount: '1.5', decimals: 6 }]);
  });

  test('an ERC-20 transfer in shows the amount arriving', async () => {
    answerRpc({ simulate: { calls: [{ status: '0x1', logs: [transferLog(PEER, ME, 2_500_000n)] }] } });
    const { assetChanges } = await simulate('0x0', CALLDATA);
    expect(assetChanges.out).toEqual([]);
    expect(assetChanges.in).toMatchObject([{ symbol: 'USDC', amount: '2.5' }]);
  });

  test('a call that moves no tokens changes no balance', async () => {
    answerRpc({ simulate: { calls: [{ status: '0x1', logs: [] }] } });
    expect((await simulate('0x0', CALLDATA)).assetChanges).toEqual({ in: [], out: [] });
  });

  test('a plain ETH send shows the value leaving as ETH', async () => {
    answerRpc({ balance: '0x1bc16d674ec80000', simulate: { calls: [{ status: '0x1', logs: [] }] } });
    const { success, assetChanges } = await simulate(ONE_ETH);
    expect(success).toBe(true);
    expect(assetChanges.out).toMatchObject([{ symbol: 'ETH', amount: '1', decimals: 18 }]);
  });

  test('an unknown token is named by its short address with 18 decimals', async () => {
    const unknown = '0x1111111111111111111111111111111111111111';
    answerRpc({ simulate: { calls: [{ status: '0x1', logs: [transferLog(ME, PEER, 10n ** 18n, unknown)] }] } });
    const [move] = (await simulate('0x0', CALLDATA)).assetChanges.out;
    expect(move?.symbol).toContain('…');
    expect(move?.amount).toBe('1');
  });
});

describe('simulateTx failures', () => {
  test('an ETH send above the balance is refused before simulating, with have and need', async () => {
    const methods = answerRpc({ balance: '0x0' });
    const result = await simulate('0x16345785d8a0000');
    expect(result).toEqual({ success: false, revertReason: 'insufficient ETH (have 0, need 0.1)', assetChanges: { in: [], out: [] } });
    expect(methods).toEqual(['eth_getBalance']);
  });

  test('a reverted call reads its Error(string) reason in plain words', async () => {
    const returnData = errorString('ERC20: transfer amount exceeds balance');
    answerRpc({ simulate: { calls: [{ status: '0x0', returnData, logs: [] }] } });
    expect(await simulate('0x0', CALLDATA)).toMatchObject({ success: false, revertReason: 'insufficient token balance' });
  });

  test('known node errors read in plain words, other reasons pass through', async () => {
    const reasons: [string, string][] = [
      ['err: insufficient funds for gas * price + value', 'insufficient ETH for value + gas'],
      ['ERC20: insufficient allowance', 'insufficient token allowance (approve first)'],
      ['execution reverted', 'transaction would revert'],
      ['Sale not active', 'Sale not active'],
    ];
    for (const [message, reason] of reasons) {
      answerRpc({ simulate: { calls: [{ status: '0x0', error: { message }, logs: [] }] } });
      expect((await simulate('0x0', CALLDATA)).revertReason).toBe(reason);
    }
  });

  test('when the node cannot simulate, a failing eth_call still names the revert', async () => {
    const methods = answerRpc({ simulate: { error: 'method not found' }, call: { error: { message: 'execution reverted' } } });
    expect(await simulate('0x0', CALLDATA)).toEqual({
      success: false,
      revertReason: 'transaction would revert',
      assetChanges: { in: [], out: [] },
    });
    expect(methods).toEqual(['eth_simulateV1', 'eth_call']);
  });

  test('when neither call explains anything the outcome is unknown', async () => {
    answerRpc({ simulate: { error: 'method not found' } });
    expect(await simulate('0x0', CALLDATA)).toEqual({ success: 'unknown', assetChanges: { in: [], out: [] }, error: 'method not found' });
  });
});
