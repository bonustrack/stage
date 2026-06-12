/** Tests for the in-chat Sign/Pay consent gate (audit HIGH/#2).
 *
 *  A stranger (unknown-consent) DM can post a live Sign/Pay request card, so the
 *  card ACTIONS must be blocked until the user accepts the conversation. The
 *  cards render the Sign/Pay button only when `isCardActionBlocked` is false. */

import { describe, expect, test } from 'bun:test';
import { isCardActionBlocked } from '../lib/consentGate';

describe('isCardActionBlocked', () => {
  test('BLOCKS Sign/Pay for an unknown / stranger conversation (consent=false)', () => {
    expect(isCardActionBlocked(false)).toBe(true);
  });

  test('ENABLES Sign/Pay for an allowed conversation (consent=true)', () => {
    expect(isCardActionBlocked(true)).toBe(false);
  });

  test('does NOT gate while consent is unresolved (undefined) - no flicker on the common accepted case', () => {
    expect(isCardActionBlocked(undefined)).toBe(false);
  });
});
