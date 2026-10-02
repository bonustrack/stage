import { afterEach, describe, expect, test } from 'bun:test';
import { decodeFunctionData, encodeAbiParameters, encodeFunctionResult, multicall3Abi, type Hex } from 'viem';
import { fetchAssetRows, fetchWalletPortfolio } from '../src/wallet/balances';

const realFetch = globalThis.fetch;
const ethId = 'ethereum:0x0000000000000000000000000000000000000000';
const address = '0x0000000000000000000000000000000000000001';
const options = { tokenLogo: () => '' };
const priceRequests: string[] = [];
const rpcPaths: string[] = [];
let ethereumPrice = 4000;

type BalanceFixture = 'funded' | 'zero' | 'reverted' | 'rpc-error';
type PriceFixture = 'missing' | 'live' | 'error' | 'changes-error';

function priceResponse(url: URL, pricing: PriceFixture): Response {
  priceRequests.push(decodeURIComponent(url.href));
  if (pricing === 'error') return new Response('', { status: 503 });
  if (pricing === 'missing') return Response.json({ coins: {} });
  if (url.pathname.startsWith('/percentage/')) {
    return pricing === 'changes-error' ? new Response('', { status: 503 }) : Response.json({ coins: { [ethId]: 2 } });
  }
  const quote = (price: number) => ({ price, timestamp: Math.floor(Date.now() / 1000), confidence: 0.99 });
  return Response.json({ coins: {
    [ethId]: quote(ethereumPrice),
    'bitcoin:btc': quote(80000),
    'base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913': quote(0.99),
  } });
}

function mockBalances(mode: BalanceFixture, pricing: PriceFixture = 'missing'): void {
  globalThis.fetch = async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    if (url.hostname === 'coins.llama.fi') return priceResponse(url, pricing);
    rpcPaths.push(url.pathname);
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

afterEach(() => { globalThis.fetch = realFetch; priceRequests.length = 0; rpcPaths.length = 0; ethereumPrice = 4000; });

describe('fetchAssetRows balance failures', () => {
  test('loads genuine balances even when price quotes are missing', async () => {
    mockBalances('funded');
    const rows = await fetchAssetRows(address, options);
    expect(rows.map(row => `${row.chainId}:${row.symbol}:${row.balance}`)).toEqual(['8453:ETH:1', '8453:USDC:1000000000000']);
    expect(rpcPaths).toEqual(['/8453']);
    expect(rows.every(row => row.priceUsd === null)).toBe(true);
  });

  test('successful zero reads remain a genuine empty wallet', async () => {
    mockBalances('zero');
    const rows = await fetchAssetRows(address, options);
    expect(rows.length).toBe(2);
    expect(rows.every(row => row.balance === '0')).toBe(true);
  });

  test('maps Base ETH and Base USDC without sending the wallet address', async () => {
    mockBalances('funded', 'live');
    const rows = await fetchAssetRows(address, options);
    expect(rows.map(row => row.priceUsd)).toEqual([4000, 0.99]);
    expect(rows.find(row => row.symbol === 'ETH')?.change24h).toBe(2);
    expect(priceRequests).toHaveLength(2);
    expect(priceRequests.every(url => !url.includes(address) && !url.includes('api_key'))).toBe(true);
    expect(priceRequests[0]).toContain(`${ethId},base:0x833589fcd6edb6e08f4c7c32d4f71b54bda02913,bitcoin:btc`);
  });

  test('price transport failures do not hide funded tokens from selection', async () => {
    mockBalances('funded', 'error');
    const rows = await fetchAssetRows(address, options);
    expect(rows.find(row => row.symbol === 'USDC' && row.chainId === 8453)?.balance).toBe('1000000000000');
    expect(rows.every(row => row.priceUsd === null)).toBe(true);
  });

  test('portfolio price transport failures reject to retain the cached valuation', async () => {
    mockBalances('funded', 'error');
    await expect(fetchWalletPortfolio(address, options)).rejects.toThrow('defillama 503');
  });

  test('a first portfolio load without prices still shows balances, with no USD values', async () => {
    mockBalances('funded', 'error');
    const portfolio = await fetchWalletPortfolio(address, options, false);
    expect(portfolio.rows.map(row => `${row.symbol}:${row.balance}`)).toEqual(['ETH:1', 'USDC:1000000000000']);
    expect(portfolio.rows.every(row => row.priceUsd === null)).toBe(true);
    expect(portfolio.prices).toEqual({ ethereum: undefined, bitcoin: undefined });
  });

  test('portfolio and denomination prices advance together in one quote request', async () => {
    mockBalances('funded', 'live');
    const first = await fetchWalletPortfolio(address, options);
    expect(first.prices.ethereum?.usd).toBe(4000);
    expect(first.rows.filter(row => row.symbol === 'ETH').every(row => row.priceUsd === first.prices.ethereum?.usd)).toBe(true);
    ethereumPrice = 5000;
    const next = await fetchWalletPortfolio(address, options);
    expect(next.prices.ethereum?.usd).toBe(5000);
    expect(next.prices.bitcoin?.usd).toBe(80000);
    expect(next.rows.filter(row => row.symbol === 'ETH').map(row => row.priceUsd)).toEqual([5000]);
    const requests = priceRequests.filter(url => url.includes('/prices/current/'));
    expect(requests).toHaveLength(2);
    expect(requests.every(url => url.includes(ethId) && url.includes('bitcoin:btc') && url.includes('base:'))).toBe(true);
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
