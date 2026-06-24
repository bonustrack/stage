
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

  test('real custom-scheme deep links pass through unchanged', () => {
    expect(r('stage://xmtp/abc123')).toBe('stage://xmtp/abc123');
    expect(r('stage://group/g1')).toBe('stage://group/g1');
    expect(r('stage://user/0xabc')).toBe('stage://user/0xabc');
    expect(r('stage://settings')).toBe('stage://settings');
  });

  test('https applinks + hash permalinks pass through unchanged', () => {
    expect(r('https://stage.box/xmtp/abc')).toBe('https://stage.box/xmtp/abc');
    expect(r('https://stage.box/#/xmtp/abc?m=1')).toBe('https://stage.box/#/xmtp/abc?m=1');
  });

  test('exp:// with a real /--/ deep link passes through', () => {
    expect(r('exp://192.168.1.5:8081/--/xmtp/abc')).toBe('exp://192.168.1.5:8081/--/xmtp/abc');
  });
});
