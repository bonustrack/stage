
import { describe, expect, test } from 'bun:test';
import { internalLinkPath, isAllowedLinkScheme } from '../lib/safeOpenLink';

describe('isAllowedLinkScheme', () => {
  test('allows web + mailto + our app schemes', () => {
    expect(isAllowedLinkScheme('https://stage.box/xmtp/abc')).toBe(true);
    expect(isAllowedLinkScheme('http://example.com')).toBe(true);
    expect(isAllowedLinkScheme('mailto:hi@stage.box')).toBe(true);
    expect(isAllowedLinkScheme('metro://xmtp/abc')).toBe(true);
    expect(isAllowedLinkScheme('stage://room/123')).toBe(true);
  });

  test('is case-insensitive on the scheme', () => {
    expect(isAllowedLinkScheme('HTTPS://example.com')).toBe(true);
    expect(isAllowedLinkScheme('Metro://xmtp/abc')).toBe(true);
  });

  test('tolerates leading/trailing whitespace', () => {
    expect(isAllowedLinkScheme('  https://example.com  ')).toBe(true);
  });

  test('rejects dangerous / arbitrary schemes', () => {
    expect(isAllowedLinkScheme('file:///etc/passwd')).toBe(false);
    expect(isAllowedLinkScheme('tel:+15551234567')).toBe(false);
    expect(isAllowedLinkScheme('sms:+15551234567')).toBe(false);
    expect(isAllowedLinkScheme('content://media/external/file/1')).toBe(false);
    expect(isAllowedLinkScheme('intent://scan/#Intent;scheme=zxing;end')).toBe(false);
    expect(isAllowedLinkScheme('javascript:alert(1)')).toBe(false);
    expect(isAllowedLinkScheme('otherapp://do-something')).toBe(false);
  });

  test('rejects scheme-less strings', () => {
    expect(isAllowedLinkScheme('example.com/path')).toBe(false);
    expect(isAllowedLinkScheme('/relative/path')).toBe(false);
    expect(isAllowedLinkScheme('')).toBe(false);
  });
});

describe('internalLinkPath', () => {
  test('reuses canonical app routes and preserves the complete query', () => {
    for (const [url, path] of [
      ['https://stage.box/#/settings', '/settings'],
      ['HTTPS://STAGE.BOX/contacts', '/contacts'],
      ['stage://channels', '/'],
      ['stage://profile/channel72', '/profile/channel72'],
      ['metro://profile/alice', '/profile/alice'],
      ['stage://xmtp/user/alice?m=a%2Fb%20c&focus=1&extra=keep', '/alice?m=a%2Fb%20c&focus=1&extra=keep'],
      ['https://stage.box/xmtp/channel72?m=abc&focus=1', '/channel/channel72?m=abc&focus=1'],
      ['stage://wallet/send?to=alice', '/wallet/send?to=alice'],
      ['https://stage.box/#/settings/display?theme=dark', '/settings/display?theme=dark'],
      ['https://stage.box/frame?convId=channel72&id=abc', '/frame?convId=channel72&id=abc'],
    ]) expect(internalLinkPath(url ?? '')).toBe(path);
  });

  test('never treats other hosts, credentials, ports or schemes as internal', () => {
    for (const url of [
      'https://example.com/#/settings', 'https://stage.box.evil.test/channel/abc',
      'https://stage.box@evil.test/#/contacts', 'https://evil.test@stage.box/#/settings',
      'https://stage.box:8080/#/profile/alice', 'https://stage.box\\@evil.test/#/settings',
      'https://stage.box./#/settings', 'https://dev.stage.box/#/settings',
      'javascript:https://stage.box/#/settings', 'file://stage.box/settings',
      '//stage.box/#/settings', '/settings', 'stage://profile/%ZZ',
      'stage://channel/bad#fragment', 'https://stage.box/#/channel/bad#fragment',
    ]) expect(internalLinkPath(url)).toBeNull();
  });

  test('keeps preview-build launch actions outside the app router', () => {
    expect(internalLinkPath('stage://expo-development-client/?url=https%3A%2F%2Fu.expo.dev%2Fbuild')).toBeNull();
    expect(internalLinkPath('https://stage.box/preview-launcher.html?u=build')).toBeNull();
  });
});
