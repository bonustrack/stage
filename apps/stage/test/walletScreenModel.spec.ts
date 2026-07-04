import { describe, expect, test } from 'bun:test';
import {
  walletHeroDisplay,
  walletTabOptions,
  walletTotalUsd,
} from '../views/wallet/walletScreenModel';

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

describe('walletHeroDisplay', () => {
  test('splits totals when loaded without error', () => {
    expect(walletHeroDisplay({ parts: { int: '$12', dec: '.34' }, error: false })).toEqual({
      total: '$12',
      totalDecimals: '.34',
      subtitle: undefined,
    });
  });

  test('null parts collapse to an ellipsis', () => {
    expect(walletHeroDisplay({ parts: null, error: false })).toEqual({
      total: '…',
      totalDecimals: undefined,
      subtitle: undefined,
    });
  });

  test('error collapses the total and adds the subtitle', () => {
    expect(walletHeroDisplay({ parts: { int: '$1', dec: '.00' }, error: true })).toEqual({
      total: '…',
      totalDecimals: undefined,
      subtitle: 'Couldn’t load balances',
    });
  });
});
