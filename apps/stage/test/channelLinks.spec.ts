import { describe, expect, test } from 'bun:test';
import { cachedChannelName, channelLinkLabel, channelLinkText, channelFallbackLabel, markdownLabelText } from '../lib/channelLinks';
import { bubbleLinkProps as nativeProps } from '../components/bubble/linkProps';
import { bubbleLinkProps as webProps } from '../components/bubble/linkProps.web';
import { routeForUrl } from '@stage-labs/client/routing/deepLinks';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';

describe('channel link names', () => {
  test('reuses real cached group names, never list fallback or direct-chat titles', () => {
    const rows = [{ convId: CONV, title: 'Design', groupName: 'Design', peerAddress: null }, { convId: 'dm', groupName: 'Alice', peerAddress: '0xabc' }];
    expect(cachedChannelName(rows, CONV)).toBe('Design');
    expect(cachedChannelName(rows, 'dm')).toBeUndefined();
    expect(cachedChannelName(null, CONV)).toBeUndefined();
    expect(cachedChannelName([{ convId: CONV, groupName: 42 }], CONV)).toBeUndefined();
    for (const title of ['3 members', CONV.slice(0, 6)]) {
      expect(cachedChannelName([{ convId: CONV, title }], CONV)).toBeUndefined();
      expect(channelLinkLabel(cachedChannelName([{ convId: CONV, title, groupName: '' }], CONV), 'Ops')).toBe('#Ops');
    }
  });

  test('known DM conversation links retain their original text instead of a hash label', () => {
    const url = `stage://xmtp/${CONV}`;
    expect(channelLinkText({ peerAddr: '0xabc' }, undefined, url)).toBe(url);
    expect(channelLinkText({ peerAddr: '0xabc' }, undefined, url, 'Alice')).toBe('Alice');
    expect(channelLinkText({ groupName: 'Ops' }, undefined, url)).toBe('#Ops');
  });

  test('reads labels recursively through Markdown emphasis', () => {
    const label = markdownLabelText({ content: '', children: [{ content: '', children: [{ content: '#Ops', children: [] }] }] });
    expect(channelLinkLabel(undefined, label)).toBe('#Ops');
    expect(channelFallbackLabel('**#Ops**')).toBe('Ops');
    expect(channelFallbackLabel('***#Ops***')).toBe('Ops');
    expect(channelFallbackLabel('**join here**')).toBeUndefined();
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
  const urls = [
    `https://stage.box/#/channel/${CONV}?m=abc&focus=1`,
    `https://stage.box/xmtp/${CONV}?m=abc&focus=1`,
    `stage://channel/${CONV}?m=abc&focus=1`,
    `stage://xmtp/${CONV}?m=abc&focus=1`,
    `metro://xmtp/${CONV}?m=abc&focus=1`,
  ];

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

  test('web ordinary clicks use the complete channel URL without opening a new tab', () => {
    for (const url of urls) {
      let opened = '';
      let prevented = false;
      const props = webProps(url, target => { opened = target; return false; });
      expect(props.href).toBe(url.replace(/^(?:metro|stage):\/\/(?:xmtp|channel)\//i, 'https://stage.box/#/channel/'));
      expect(props.hrefAttrs).toBeUndefined();
      expect(typeof props.ref).toBe('function');
      props.onPress?.({ defaultPrevented: false, button: 0, preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(true);
      expect(opened).toBe(url);
      expect(routeForUrl(opened)).toEqual({ pathname: '/channel/[convId]', params: { convId: CONV, m: 'abc', focus: '1' } });
    }
  });

  test('web leaves modified, middle, right and cancelled clicks to the browser', () => {
    for (const url of urls) {
      const props = webProps(url, () => { throw new Error('must not route'); });
      for (const options of [
        { metaKey: true }, { ctrlKey: true }, { altKey: true }, { shiftKey: true },
        { button: 1 }, { button: 2 }, { defaultPrevented: true },
      ]) {
        props.onPress?.({ defaultPrevented: false, button: 0, ...options,
          preventDefault: () => { throw new Error('must not cancel'); } });
      }
    }
  });

  test('web keyboard activation routes once and keeps encoded message parameters', () => {
    const url = `stage://xmtp/${CONV}?m=a%2Fb%20c&focus=1`;
    let opened = '';
    let prevented = 0;
    webProps(url, target => { opened = target; return false; }).onPress?.({
      defaultPrevented: false, preventDefault: () => { prevented++; },
    });
    expect(prevented).toBe(1);
    expect(routeForUrl(opened)).toEqual({ pathname: '/channel/[convId]', params: { convId: CONV, m: 'a/b c', focus: '1' } });
  });

  test('web external, non-channel and malformed links keep their previous behavior', () => {
    for (const url of [
      'https://example.com/#/channel/other', 'mailto:hi@example.com',
      'https://stage.box/#/settings', 'stage://profile/alice',
      'stage://xmtp/user/0x1111111111111111111111111111111111111111',
      'https://stage.box/#/channel/bad#fragment', 'stage://channel/bad/extra',
    ]) {
      const props = webProps(url, () => { throw new Error('browser handles it'); });
      expect(props.href).toBe(url);
      expect(props.onPress).toBeUndefined();
      expect(props.hrefAttrs).toEqual({ target: '_blank', rel: 'noopener noreferrer' });
    }
    const blocked = webProps('javascript:alert(1)', () => false);
    expect(blocked.href).toBeUndefined();
  });
});
