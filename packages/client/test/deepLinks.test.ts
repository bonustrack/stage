import { describe, expect, test } from 'bun:test';
import { routeForUrl } from '../src/routing/deepLinks';

const ADDR = '0xEAe6aa1802e2938F510ecDc6Ae18f538be6ED9e1';
const CHANNEL = '449ce5e585c1ed5db256b6fd7cbd60e7';

describe('routeForUrl', () => {
  test('opens conversations by address, stage label or ens name', () => {
    expect(routeForUrl(`https://stage.box/#/${ADDR}?m=abc`)).toEqual({ pathname: '/[convId]', params: { convId: ADDR, m: 'abc' } });
    expect(routeForUrl('https://stage.box/#/boorger')).toEqual({ pathname: '/[convId]', params: { convId: 'boorger' } });
    expect(routeForUrl('https://stage.box/#/fabien.eth')).toEqual({ pathname: '/[convId]', params: { convId: 'fabien.eth' } });
  });

  test('opens user and channel profiles under /profile with any handle', () => {
    expect(routeForUrl('https://stage.box/#/profile/boorger')).toEqual({ pathname: '/profile/[id]', params: { id: 'boorger' } });
    expect(routeForUrl(`https://stage.box/#/profile/${CHANNEL}`)).toEqual({ pathname: '/profile/[id]', params: { id: CHANNEL } });
    expect(routeForUrl('https://stage.box/#/profile')).toBeNull();
  });

  test('old /user and /group links are not routes', () => {
    expect(routeForUrl(`https://stage.box/#/user/${ADDR}`)).toBeNull();
    expect(routeForUrl(`https://stage.box/#/group/${CHANNEL}`)).toBeNull();
    expect(routeForUrl(`stage://group/${CHANNEL}`)).toBeNull();
  });

  test('keeps static routes ahead of handles and rejects junk', () => {
    expect(routeForUrl('https://stage.box/#/settings')).toEqual({ pathname: '/(tabs)/settings' });
    expect(routeForUrl('https://stage.box/#/board')).toEqual({ pathname: '/board' });
    expect(routeForUrl('https://stage.box/#/')).toEqual({ pathname: '/(tabs)' });
    expect(routeForUrl('https://stage.box/#/-bad-')).toBeNull();
    expect(routeForUrl('https://stage.box/#/requests')).toBeNull();
  });
});
