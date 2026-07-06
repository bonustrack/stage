
import { describe, expect, test } from 'bun:test';
import { redirectSystemPath } from '../app/+native-intent';

const r = (path: string): string => redirectSystemPath({ path, initial: true });

const PROJECT = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const GROUP = '27ac1746-b19f-4d16-a4c1-b04280d36626';
const EXPO = `https://u.expo.dev/${PROJECT}/group/${GROUP}`;

describe('redirectSystemPath', () => {
  test('stage:// dev-client launch link → home', () => {
    expect(r(`stage://expo-development-client/?url=${EXPO}`)).toBe('/');
  });

  test('metro:// dev-client launch link → home', () => {
    expect(r(`metro://expo-development-client/?url=${EXPO}`)).toBe('/');
  });

  test('bare scheme launch (stage:// and stage:///) → home', () => {
    expect(r('stage://')).toBe('/');
    expect(r('stage:///')).toBe('/');
  });

  test('exp:// Expo Go launch shell without /--/ → home', () => {
    expect(r('exp://192.168.1.5:8081')).toBe('/');
    expect(r('exp+stage://expo-development-client')).toBe('/');
  });

  test('non-conversation custom-scheme deep links pass through unchanged', () => {
    expect(r('stage://group/g1')).toBe('stage://group/g1');
    expect(r('stage://user/0xabc')).toBe('stage://user/0xabc');
    expect(r('stage://settings')).toBe('stage://settings');
  });

  test('channel + address deep links pass through unchanged', () => {
    expect(r('stage://channel/47bf58a8f56cad829b2263797a7e25e4'))
      .toBe('stage://channel/47bf58a8f56cad829b2263797a7e25e4');
    expect(r('stage://0x1234567890123456789012345678901234567890'))
      .toBe('stage://0x1234567890123456789012345678901234567890');
    expect(r('https://stage.box/#/0x1234567890123456789012345678901234567890'))
      .toBe('https://stage.box/#/0x1234567890123456789012345678901234567890');
  });

  test('legacy xmtp/ channel deep links are rewritten to channel/ form', () => {
    expect(r('stage://xmtp/abc123')).toBe('stage://channel/abc123');
    expect(r('https://stage.box/xmtp/abc')).toBe('https://stage.box/channel/abc');
    expect(r('https://stage.box/#/xmtp/abc?m=1')).toBe('https://stage.box/#/channel/abc?m=1');
    expect(r('exp://192.168.1.5:8081/--/xmtp/abc')).toBe('exp://192.168.1.5:8081/--/channel/abc');
  });

  test('legacy xmtp/user/ DM deep links are rewritten to the bare address form', () => {
    expect(r('stage://xmtp/user/0x1234567890123456789012345678901234567890'))
      .toBe('stage://0x1234567890123456789012345678901234567890');
    expect(r('https://stage.box/#/xmtp/user/0x1234567890123456789012345678901234567890'))
      .toBe('https://stage.box/#/0x1234567890123456789012345678901234567890');
  });
});
