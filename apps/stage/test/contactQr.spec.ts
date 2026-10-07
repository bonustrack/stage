import { describe, expect, test } from 'bun:test';
import { getAddress } from 'viem';
import { routeForUrl } from '@stage-labs/client/routing/deepLinks';
import { contactQrValue, contactScanResult, parseContactQr } from '../components/contacts/ContactQr.model';
import { internalLinkPath } from '../lib/safeOpenLink';
import { redirectSystemPath } from '../app/+native-intent';

const ALICE = getAddress('0x42e167e6bff0a3a701d8fa14f96a0f840eb939df');
const BOB = '0x1111111111111111111111111111111111111111';
const LINK = `stage://profile/${ALICE}`;

describe('Stage contact QR codes', () => {
  test('shares only the current public address in an existing profile link', () => {
    expect(contactQrValue(ALICE)).toBe(LINK);
    expect(parseContactQr(LINK)).toBe(ALICE);
    expect(parseContactQr(ALICE.toLowerCase())).toBe(ALICE);
    expect(parseContactQr(`  ${LINK}\n`)).toBe(ALICE);
    expect(contactQrValue(BOB)).toBe(`stage://profile/${BOB}`);
    expect(contactQrValue(null)).toBeNull();
    expect(contactQrValue(undefined)).toBeNull();
    expect(contactQrValue('')).toBeNull();
  });

  test('rejects non-contact links, malformed addresses and secret payloads', () => {
    for (const input of [
      '', 'alice.stage.base.eth', '0x1234', `${BOB}00`, BOB.slice(2),
      '0x0000000000000000000000000000000000000000',
      ALICE.replace('BfF', 'bff').replace('E', 'e'),
      `https://stage.box/#/profile/${BOB}`, `https://evil.test/${LINK}`,
      `stage://wallet/send?to=${BOB}`, `stage://channel/${BOB}`, `stage://import?key=${BOB}`,
      `stage://profile/${BOB}?next=/wallet`, `${LINK}#fragment`, `${LINK}/`, `${LINK}/extra`,
      `stage://profile@evil.test/${BOB}`, `stage://evil.test/profile/${BOB}`,
      `stage://profile//${BOB}`, `stage://profile/%30x${BOB.slice(2)}`,
      `stage://profile/${BOB}\n/extra`, `stage://profile\\${BOB}`,
      `javascript:location.href='${LINK}'`, 'data:text/plain,hello',
      'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about',
      `0x${'1'.repeat(64)}`, JSON.stringify({ address: BOB, privateKey: 'secret' }), 'x'.repeat(100000),
    ]) {
      expect(parseContactQr(input)).toBeNull();
      expect(contactQrValue(input)).toBeNull();
    }
  });

  test('web and native deep links reach the same existing contact profile', () => {
    const target = { pathname: '/profile/[id]', params: { id: ALICE } };
    expect(routeForUrl(LINK)).toEqual(target);
    expect(internalLinkPath(LINK)).toBe(`/profile/${ALICE}`);
    expect(routeForUrl(redirectSystemPath({ path: LINK, initial: true }))).toEqual(target);
    expect(routeForUrl(redirectSystemPath({ path: LINK, initial: false }))).toEqual(target);
  });

  test('scanning never returns wallet, authentication or message actions', () => {
    expect(contactScanResult(LINK, BOB, 4, 4)).toEqual({ path: `/profile/${ALICE}` });
    expect(contactScanResult(ALICE, BOB, 4, 4)).toEqual({ path: `/profile/${ALICE}` });
    expect(contactScanResult('invalid', BOB, 4, 4)).toEqual({ error: 'Use a Stage contact QR code or a public address.' });
    expect(contactScanResult(ALICE.toLowerCase(), ALICE, 4, 4)?.error).toContain('your own address');
  });

  test('an account switch discards old scan results, including switch away and back', () => {
    expect(contactScanResult(LINK, BOB, 4, 5)).toBeNull();
    expect(contactScanResult(LINK, BOB, 4, 6)).toBeNull();
    expect(contactScanResult('invalid', BOB, 4, 5)).toBeNull();
    expect(contactQrValue(BOB)).not.toBe(contactQrValue(ALICE));
    expect(contactScanResult(BOB, ALICE, 5, 5)).toEqual({ path: `/profile/${BOB}` });
  });
});
