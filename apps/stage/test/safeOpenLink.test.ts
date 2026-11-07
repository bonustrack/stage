import { describe, expect, test } from 'bun:test';
import { internalLinkPath } from '@stage-labs/client/routing/deepLinks';
import { isAllowedLinkScheme } from '@stage-labs/client/routing/stageLinks';

describe('isAllowedLinkScheme', () => {
  test('allows web + mailto + our app schemes', () => {
    for (const url of ['https://stage.box/xmtp/abc', 'http://example.com', 'mailto:hi@stage.box', 'metro://xmtp/abc', 'stage://room/123']) {
      expect(isAllowedLinkScheme(url)).toBe(true);
    }
  });

  test('is case-insensitive on the scheme', () => {
    for (const url of ['HTTPS://example.com', 'Metro://xmtp/abc']) expect(isAllowedLinkScheme(url)).toBe(true);
  });

  test('tolerates leading/trailing whitespace', () => {
    expect(isAllowedLinkScheme('  https://example.com  ')).toBe(true);
  });

  test('rejects dangerous / arbitrary schemes', () => {
    for (const url of ['file:///etc/passwd', 'tel:+15551234567', 'sms:+15551234567', 'content://media/external/file/1']) {
      expect(isAllowedLinkScheme(url)).toBe(false);
    }
    for (const url of ['intent://scan/#Intent;scheme=zxing;end', 'javascript:alert(1)', 'otherapp://do-something']) {
      expect(isAllowedLinkScheme(url)).toBe(false);
    }
  });

  test('rejects scheme-less strings', () => {
    for (const url of ['example.com/path', '/relative/path', '']) expect(isAllowedLinkScheme(url)).toBe(false);
  });
});

describe('internalLinkPath', () => {
  test('reuses canonical app routes and preserves the complete query', () => {
    for (const [url, path] of [
      ['https://stage.box/#/settings', '/settings'],
      ['HTTPS://STAGE.BOX/contacts', '/contacts'],
      ['https://stage.box/#/dashboard', '/dashboard'],
      ['https://stage.box/#/inbox/mail?label=alice&id=abc', '/inbox/mail?label=alice&id=abc'],
      ['stage://channels', '/'],
      ['stage://profile/channel72', '/profile/channel72'],
      ['metro://profile/alice', '/profile/alice'],
      ['stage://xmtp/user/alice?m=a%2Fb%20c&focus=1&extra=keep', '/alice?m=a%2Fb%20c&focus=1&extra=keep'],
      ['https://stage.box/xmtp/channel72?m=abc&focus=1', '/channel/channel72?m=abc&focus=1'],
      ['stage://wallet/send?to=alice', '/wallet/send?to=alice'],
      ['https://stage.box/#/settings/display?theme=dark', '/settings/display?theme=dark'],
      ['https://stage.box/frame?convId=channel72&id=abc', '/frame?convId=channel72&id=abc'],
    ] satisfies [string, string][])
      expect(internalLinkPath(url)).toBe(path);
  });

  test('never treats other hosts, credentials, ports or schemes as internal', () => {
    for (const url of [
      'https://example.com/#/settings',
      'https://stage.box.evil.test/channel/abc',
      'https://stage.box@evil.test/#/contacts',
      'https://evil.test@stage.box/#/settings',
      'https://stage.box:8080/#/profile/alice',
      'https://stage.box\\@evil.test/#/settings',
      'https://stage.box./#/settings',
      'https://dev.stage.box/#/settings',
      'javascript:https://stage.box/#/settings',
      'file://stage.box/settings',
      '//stage.box/#/settings',
      '/settings',
      'stage://profile/%ZZ',
      'stage://channel/bad#fragment',
      'https://stage.box/#/channel/bad#fragment',
    ])
      expect(internalLinkPath(url)).toBeNull();
  });

  test('never routes a stage.box link to a path the router opens as another site', () => {
    for (const url of [
      'https://stage.box//evil.test/',
      'https://stage.box/#//evil.test',
      'https://stage.box/#///evil.test',
      'stage:///evil.test',
      'stage:////evil.test',
      'metro:///evil.test',
    ])
      expect(internalLinkPath(url)).toBeNull();
  });

  test('keeps preview-build launch actions outside the app router', () => {
    expect(internalLinkPath('stage://expo-development-client/?url=https%3A%2F%2Fu.expo.dev%2Fbuild')).toBeNull();
    expect(internalLinkPath('https://stage.box/preview-launcher.html?u=build')).toBeNull();
  });
});
