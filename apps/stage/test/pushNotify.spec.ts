import { describe, expect, test } from 'bun:test';
import {
  convIdOfNotificationData, javaStringHash, nativeCardIdentifier, notificationIdsForConv,
} from '../lib/pushNotify.model';

const CONV = '0123456789abcdef0123456789abcdef';

describe('the Android card id matches Kotlin String.hashCode', () => {
  test('known hash values, including overflow', () => {
    expect(javaStringHash('')).toBe(0);
    expect(javaStringHash('abc')).toBe(96354);
    expect(javaStringHash('hello')).toBe(99162322);
    expect(javaStringHash('Aa')).toBe(javaStringHash('BB'));
    expect(javaStringHash('polygenelubricants')).toBe(-2147483648);
  });

  test('builds the expo identifier of the card StageFcmService posts', () => {
    expect(nativeCardIdentifier(CONV.toUpperCase()))
      .toBe(`expo-notifications://foreign_notifications?id=${javaStringHash(CONV)}`);
  });
});

describe('notificationIdsForConv', () => {
  const presented = [
    { identifier: 'a', data: { convId: CONV } },
    { identifier: 'b', data: { convId: 'ffff' } },
    { identifier: 'c', data: null },
    { identifier: nativeCardIdentifier(CONV), data: {} },
  ];

  test('picks the cards of that conversation and the native card on Android', () => {
    expect(notificationIdsForConv(presented, CONV, true)).toEqual(['a', nativeCardIdentifier(CONV)]);
  });

  test('skips the native card elsewhere', () => {
    expect(notificationIdsForConv(presented, CONV, false)).toEqual(['a']);
    expect(notificationIdsForConv([], CONV, false)).toEqual([]);
  });

  test('reads the conversation id only from a string field', () => {
    expect(convIdOfNotificationData({ convId: CONV })).toBe(CONV);
    expect(convIdOfNotificationData({ convId: '' })).toBeNull();
    expect(convIdOfNotificationData({ convId: 5 })).toBeNull();
    expect(convIdOfNotificationData('x')).toBeNull();
  });
});
