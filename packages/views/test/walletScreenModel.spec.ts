import { describe, expect, test } from 'bun:test';
import {
  walletBalanceHeroNode,
  walletTabOptions,
  walletTotalUsd,
} from '../src/wallet/walletScreenModel';
import { WALLET_ACTION_PRESS } from '../src/actions';

describe('walletTabOptions', () => {
  test('defaults to the web three-tab list', () => {
    expect(walletTabOptions()).toEqual([
      { value: 'tokens', label: 'Tokens' },
      { value: 'nfts', label: 'NFTs' },
      { value: 'activity', label: 'Activity' },
    ]);
  });

  test('privateTab appends the Railgun tab for mobile', () => {
    expect(walletTabOptions({ privateTab: true }).map(o => o.value)).toEqual([
      'tokens', 'nfts', 'activity', 'private',
    ]);
    expect(walletTabOptions({ privateTab: true })[3]).toEqual({ value: 'private', label: 'Railgun' });
  });
});

describe('walletTotalUsd', () => {
  test('null rows stay null', () => {
    expect(walletTotalUsd(null)).toBeNull();
  });

  test('sums priceUsd * balance treating null prices as zero', () => {
    expect(walletTotalUsd([
      { priceUsd: 2, balance: '3' },
      { priceUsd: null, balance: '10' },
      { priceUsd: 0.5, balance: '4' },
    ])).toBe(8);
  });
});

describe('walletBalanceHeroNode', () => {
  function heroTitles(node: ReturnType<typeof walletBalanceHeroNode>): unknown {
    const header = node.children?.[0];
    if (!header || !('children' in header)) return undefined;
    return header.children?.[0];
  }

  test('renders split totals with Send/Receive actions by default', () => {
    const node = walletBalanceHeroNode({ parts: { int: '$12', dec: '.34' }, error: false }, '#eee');
    const hero = heroTitles(node);
    expect(JSON.stringify(hero)).toContain('"$12"');
    expect(JSON.stringify(hero)).toContain('".34"');
    const json = JSON.stringify(node);
    expect(json).toContain('"Send"');
    expect(json).toContain('"Receive"');
    expect(json).not.toContain('"Swap"');
    expect(json).not.toContain('"Buy"');
    expect(json).toContain(WALLET_ACTION_PRESS);
    expect(json).not.toContain('Couldn’t load balances');
  });

  test('swapBuy adds Swap and Buy actions', () => {
    const json = JSON.stringify(
      walletBalanceHeroNode({ parts: { int: '$1', dec: '.00' }, error: false }, '#eee', { swapBuy: true }),
    );
    expect(json).toContain('"Swap"');
    expect(json).toContain('"Buy"');
  });

  test('error collapses total to ellipsis and errorSubtitle adds the subtitle', () => {
    const plain = JSON.stringify(
      walletBalanceHeroNode({ parts: { int: '$1', dec: '.00' }, error: true }, '#eee'),
    );
    expect(plain).toContain('"…"');
    expect(plain).not.toContain('"$1"');
    expect(plain).not.toContain('Couldn’t load balances');
    const withSubtitle = JSON.stringify(
      walletBalanceHeroNode({ parts: null, error: true }, '#eee', { errorSubtitle: true }),
    );
    expect(withSubtitle).toContain('Couldn’t load balances');
  });
});
