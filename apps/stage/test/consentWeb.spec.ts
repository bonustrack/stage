import { describe, expect, test } from 'bun:test';
import { ConsentState } from '@xmtp/browser-sdk';
import { webConsentState, webListOptions, xmtpConsentOf } from '../lib/xmtp.sdk.web.consent';

describe('web consent', () => {
  test('a consent filter becomes the browser SDK list option', () => {
    expect(webListOptions(['allowed'])).toEqual({ consentStates: [ConsentState.Allowed] });
    expect(webListOptions(['allowed', 'unknown'])).toEqual({ consentStates: [ConsentState.Allowed, ConsentState.Unknown] });
  });

  test('no filter lists every conversation', () => {
    expect(webListOptions(undefined)).toBeUndefined();
  });

  test('each consent maps to its own browser SDK state', () => {
    expect(webConsentState('allowed')).toBe(ConsentState.Allowed);
    expect(webConsentState('denied')).toBe(ConsentState.Denied);
    expect(webConsentState('unknown')).toBe(ConsentState.Unknown);
  });

  test('each browser SDK state reads as its consent', () => {
    expect(xmtpConsentOf(ConsentState.Allowed)).toBe('allowed');
    expect(xmtpConsentOf(ConsentState.Denied)).toBe('denied');
    expect(xmtpConsentOf(ConsentState.Unknown)).toBe('unknown');
  });
});
