import { describe, expect, test } from 'bun:test';
import { bubbleLinkProps as nativeProps } from '../components/bubble/linkProps';
import { bubbleLinkProps as webProps } from '../components/bubble/linkProps.web';
import { routeForUrl } from '@stage-labs/client/routing/deepLinks';
import { internalLinkPath } from '../lib/safeOpenLink';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';

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

  test('web internal profile, DM, tab and nested links use the same click convention', () => {
    for (const url of [
      'https://stage.box/#/settings', 'stage://profile/alice',
      'stage://xmtp/user/0x1111111111111111111111111111111111111111?m=abc&focus=1',
      'https://stage.box/#/contacts', 'stage://channels', 'stage://board',
      'https://stage.box/settings/display?theme=dark', 'stage://wallet/send?to=alice',
    ]) {
      let opened = '';
      let prevented = false;
      const props = webProps(url, target => { opened = target; return false; });
      expect(props.href).toBe(url.startsWith('stage://') ? `https://stage.box/#${internalLinkPath(url)}` : url);
      expect(props.hrefAttrs).toBeUndefined();
      props.onPress?.({ defaultPrevented: false, preventDefault: () => { prevented = true; } });
      expect(prevented).toBe(true);
      expect(opened).toBe(url);
      props.onPress?.({ defaultPrevented: false, ctrlKey: true, preventDefault: () => { throw new Error('keep browser action'); } });
    }
  });

  test('web external and malformed links keep their previous behavior', () => {
    for (const url of [
      'https://example.com/#/channel/other', 'mailto:hi@example.com',
      'https://stage.box.evil.test/#/settings', 'https://stage.box@evil.test/#/contacts',
      'https://stage.box/#/channel/bad#fragment', 'stage://profile/%ZZ',
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
