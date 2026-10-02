import { afterEach, describe, expect, test } from 'bun:test';
import { fetchTxTime } from '../src/wallet/txTime';

const realFetch = globalThis.fetch;
const HASH = '0xd11ae537c41c5d81911fab079308ca9a3d780a6e736d383477a8a14e023fc84a';
const BLOCK = '0x31a6577';
const MINED_AT = '2026-10-02T02:54:09.000Z';
const requests: string[] = [];

type TxState = 'mined' | 'pending' | 'unknown';

function txResult(state: TxState): object | null {
  if (state === 'unknown') return null;
  return { hash: HASH, blockNumber: state === 'mined' ? BLOCK : null, blockHash: null, transactionIndex: null };
}

function mockRpc(state: TxState): void {
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const body = await request.json() as { id: number; method: string };
    requests.push(`${new URL(request.url).pathname} ${body.method}`);
    const result = body.method === 'eth_getTransactionByHash'
      ? txResult(state)
      : { number: BLOCK, timestamp: `0x${(Date.parse(MINED_AT) / 1000).toString(16)}`, transactions: [] };
    return Response.json({ id: body.id, jsonrpc: '2.0', result });
  };
}

afterEach(() => {
  globalThis.fetch = realFetch;
  requests.length = 0;
});

describe('fetchTxTime', () => {
  test('a mined transaction gives its block time, read from the chain of the receipt', async () => {
    mockRpc('mined');
    expect(await fetchTxTime(8453, HASH)).toBe(MINED_AT);
    expect(requests).toEqual(['/8453 eth_getTransactionByHash', '/8453 eth_getBlockByNumber']);
  });

  test('a pending transaction has no time yet', async () => {
    mockRpc('pending');
    expect(await fetchTxTime(8453, HASH)).toBeNull();
    expect(requests).toEqual(['/8453 eth_getTransactionByHash']);
  });

  test('a transaction the node does not know yet has no time either, without an error', async () => {
    mockRpc('unknown');
    expect(await fetchTxTime(8453, HASH)).toBeNull();
    expect(requests).toEqual(['/8453 eth_getTransactionByHash']);
  });

  test('a reference that is not a transaction hash makes no request', async () => {
    mockRpc('mined');
    expect(await fetchTxTime(8453, '0xabc')).toBeNull();
    expect(requests).toEqual([]);
  });
});
