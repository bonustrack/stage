import { describe, expect, test } from 'bun:test';
import { cachedChannelName, channelLinkLabel } from '../lib/channelLinks';
import { bubbleLinkProps as nativeProps } from '../components/bubble/linkProps';
import { bubbleLinkProps as webProps } from '../components/bubble/linkProps.web';
import { routeForUrl } from '@stage-labs/client/routing/deepLinks';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';

describe('channel link names', () => {
  test('reuses cached group titles, never direct-chat titles', () => {
    const rows = [{ convId: CONV, title: 'Design', peerAddress: null }, { convId: 'dm', title: 'Alice', peerAddress: '0xabc' }];
    expect(cachedChannelName(rows, CONV)).toBe('Design');
    expect(cachedChannelName(rows, 'dm')).toBeUndefined();
    expect(cachedChannelName(null, CONV)).toBeUndefined();
    expect(cachedChannelName([{ convId: CONV, title: 42 }], CONV)).toBeUndefined();
  });

  test('uses one hash and a real name or supplied channel label, otherwise #channel', () => {
    expect(channelLinkLabel(' Ops (night) ')).toBe('#Ops (night)');
    expect(channelLinkLabel('##Ops', 'old')).toBe('#Ops');
    expect(channelLinkLabel('', 'Ops')).toBe('#Ops');
    expect(channelLinkLabel(undefined)).toBe('#channel');
    expect(channelLinkLabel('   ', ' # ')).toBe('#channel');
  });
});

describe('channel link platform clicks', () => {
  const urls = [`https://stage.box/#/channel/${CONV}?m=abc&focus=1`, `stage://channel/${CONV}?m=abc&focus=1`];

  test('native calls the existing link opener with the complete URL', () => {
    for (const url of urls) {
      let opened = '';
      const props = nativeProps(url, target => { opened = target; return false; });
      expect(props.href).toBeUndefined();
      props.onPress?.();
      expect(opened).toBe(url);
      expect(routeForUrl(opened)).toEqual({ pathname: '/channel/[convId]', params: { convId: CONV, m: 'abc', focus: '1' } });
    }
  });

  test('web keeps real hrefs, browser context menus and existing new-tab behavior', () => {
    for (const url of urls) {
      const props = webProps(url, () => false);
      expect(props.href).toBe(url);
      expect(props.onPress).toBeUndefined();
      expect(props.hrefAttrs).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
      expect(typeof props.ref).toBe('function');
    }
  });
});
