import { describe, expect, test } from 'bun:test';
import { ConsentState } from '@xmtp/browser-sdk';
import { webConsentState, webListOptions } from '../lib/consentWeb.model';

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
});
