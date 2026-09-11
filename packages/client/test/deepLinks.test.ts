import { describe, expect, test } from 'bun:test';
import { routeForUrl } from '../src/routing/deepLinks';

const ADDR = '0xEAe6aa1802e2938F510ecDc6Ae18f538be6ED9e1';

describe('routeForUrl', () => {
  test('opens conversations by address, stage label or ens name', () => {
    expect(routeForUrl(`https://stage.box/#/${ADDR}?m=abc`)).toEqual({ pathname: '/[convId]', params: { convId: ADDR, m: 'abc' } });
    expect(routeForUrl('https://stage.box/#/boorger')).toEqual({ pathname: '/[convId]', params: { convId: 'boorger' } });
    expect(routeForUrl('https://stage.box/#/fabien.eth')).toEqual({ pathname: '/[convId]', params: { convId: 'fabien.eth' } });
  });

  test('opens profiles under /profile and /user with any handle', () => {
    expect(routeForUrl('https://stage.box/#/profile/boorger')).toEqual({ pathname: '/user/[address]', params: { address: 'boorger' } });
    expect(routeForUrl(`https://stage.box/#/user/${ADDR}`)).toEqual({ pathname: '/user/[address]', params: { address: ADDR } });
  });

  test('keeps static routes ahead of handles and rejects junk', () => {
    expect(routeForUrl('https://stage.box/#/settings')).toEqual({ pathname: '/(tabs)/settings' });
    expect(routeForUrl('https://stage.box/#/')).toEqual({ pathname: '/(tabs)' });
    expect(routeForUrl('https://stage.box/#/-bad-')).toBeNull();
    expect(routeForUrl('https://stage.box/#/requests')).toBeNull();
  });
});
