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

  test('each consent is written as its browser SDK state and reads back as itself', () => {
    for (const [consent, state] of [
      ['allowed', ConsentState.Allowed],
      ['denied', ConsentState.Denied],
      ['unknown', ConsentState.Unknown],
    ] as const) {
      expect(webConsentState(consent)).toBe(state);
      expect(xmtpConsentOf(webConsentState(consent))).toBe(consent);
    }
  });
});
