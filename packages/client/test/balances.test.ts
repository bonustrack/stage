import { afterEach, describe, expect, test } from 'bun:test';
import { decodeFunctionData, encodeAbiParameters, encodeFunctionResult, multicall3Abi, type Hex } from 'viem';
import { fetchAssetRows } from '../src/wallet/balances';

const realFetch = globalThis.fetch;
const address = '0x0000000000000000000000000000000000000001';
const options = { tokenLogo: () => '' };
const priceRequests: string[] = [];

type BalanceFixture = 'funded' | 'zero' | 'reverted' | 'rpc-error';
type PriceFixture = 'missing' | 'live' | 'error' | 'changes-error';

function priceResponse(url: URL, pricing: PriceFixture): Response {
  priceRequests.push(decodeURIComponent(url.href));
  if (pricing === 'error') return new Response('', { status: 503 });
  if (pricing === 'missing') return Response.json({ coins: {} });
  if (url.pathname.startsWith('/percentage/')) {
    return pricing === 'changes-error' ? new Response('', { status: 503 }) : Response.json({ coins: { 'coingecko:ethereum': 2 } });
  }
  const quote = (price: number) => ({ price, timestamp: Math.floor(Date.now() / 1000), confidence: 0.99 });
  return Response.json({ coins: {
    'coingecko:ethereum': quote(4000),
    'ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': quote(1),
    'base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': quote(0.99),
  } });
}

function mockBalances(mode: BalanceFixture, pricing: PriceFixture = 'missing'): void {
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === 'coins.llama.fi') return priceResponse(url, pricing);
    const body = await request.json() as { id: number; params: [{ data: Hex }] };
    if (mode === 'rpc-error' && url.pathname === '/8453') {
      return Response.json({ id: body.id, jsonrpc: '2.0', error: { code: -32602, message: 'Fixture RPC unavailable' } });
    }
    const decoded = decodeFunctionData({ abi: multicall3Abi, data: body.params[0].data });
    if (decoded.functionName !== 'aggregate3') throw new Error('Unexpected wallet RPC call');
    const results = decoded.args[0].map((_call, index) => ({
      success: !(mode === 'reverted' && url.pathname === '/8453' && index === 1),
      returnData: encodeAbiParameters([{ type: 'uint256' }], [mode === 'zero' ? 0n : 10n ** 18n]),
    }));
    return Response.json({
      id: body.id, jsonrpc: '2.0',
      result: encodeFunctionResult({ abi: multicall3Abi, functionName: 'aggregate3', result: results }),
    });
  };
}

afterEach(() => { globalThis.fetch = realFetch; priceRequests.length = 0; });

describe('fetchAssetRows balance failures', () => {
  test('loads genuine balances even when price quotes are missing', async () => {
    mockBalances('funded');
    const rows = await fetchAssetRows(address, options);
    expect(rows.filter(row => row.symbol === 'ETH').map(row => row.balance)).toEqual(['1', '1', '1']);
    expect(rows.every(row => row.priceUsd === null)).toBe(true);
  });

  test('successful zero reads remain a genuine empty wallet', async () => {
    mockBalances('zero');
    const rows = await fetchAssetRows(address, options);
    expect(rows.length).toBe(7);
    expect(rows.every(row => row.balance === '0')).toBe(true);
  });

  test('maps native ETH and each USDC contract without sending the wallet address', async () => {
    mockBalances('funded', 'live');
    const rows = await fetchAssetRows(address, options);
    expect(rows.filter(row => row.symbol === 'ETH').map(row => row.priceUsd)).toEqual([4000, 4000, 4000]);
    expect(rows.filter(row => row.symbol === 'USDC').map(row => row.priceUsd)).toEqual([1, 1, 0.99]);
    expect(rows.find(row => row.symbol === 'STAGE')?.priceUsd).toBeNull();
    expect(rows.find(row => row.symbol === 'ETH')?.change24h).toBe(2);
    expect(priceRequests).toHaveLength(2);
    expect(priceRequests.every(url => !url.includes(address) && !url.includes('api_key'))).toBe(true);
    expect(priceRequests[0]).toContain('coingecko:ethereum,ethereum:0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48,base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913');
  });

  test('price transport failures reject so a query keeps its cached portfolio', async () => {
    mockBalances('funded', 'error');
    await expect(fetchAssetRows(address, options)).rejects.toThrow('defillama 503');
  });

  test('optional change history failure does not hide current prices', async () => {
    mockBalances('funded', 'changes-error');
    const rows = await fetchAssetRows(address, options);
    expect(rows[0]?.priceUsd).toBe(4000);
    expect(rows[0]?.change24h).toBeNull();
  });

  test('a reverted balance call rejects rather than substituting zero', async () => {
    mockBalances('reverted');
    await expect(fetchAssetRows(address, options)).rejects.toThrow();
  });

  test('an RPC failure rejects rather than emptying one chain', async () => {
    mockBalances('rpc-error');
    await expect(fetchAssetRows(address, options)).rejects.toThrow();
  });
});
