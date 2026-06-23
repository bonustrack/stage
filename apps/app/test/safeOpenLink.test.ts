
import { describe, expect, test } from 'bun:test';
import { isAllowedLinkScheme } from '../lib/safeOpenLink';

describe('isAllowedLinkScheme', () => {
  test('allows web + mailto + our app schemes', () => {
    expect(isAllowedLinkScheme('https://metro.box/xmtp/abc')).toBe(true);
    expect(isAllowedLinkScheme('http://example.com')).toBe(true);
    expect(isAllowedLinkScheme('mailto:hi@metro.box')).toBe(true);
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
