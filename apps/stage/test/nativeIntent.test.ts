import { describe, expect, test } from 'bun:test';
import { EAS_UPDATES_URL } from '@stage-labs/client/endpoints';
import { redirectSystemPath } from '../app/+native-intent';

const r = (path: string): string => redirectSystemPath({ path, initial: true });

const GROUP = '27ac1746-b19f-4d16-a4c1-b04280d36626';
const EXPO = `${EAS_UPDATES_URL}/group/${GROUP}`;

describe('redirectSystemPath', () => {
  test('stage:// dev-client launch link → home', () => {
    expect(r(`stage://expo-development-client/?url=${EXPO}`)).toBe('/');
  });

  test('legacy-scheme dev-client launch link → home', () => {
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
    for (const link of ['stage://group/g1', 'stage://user/0xabc', 'stage://settings']) expect(r(link)).toBe(link);
  });

  test('channel + address deep links pass through unchanged', () => {
    expect(r('stage://channel/47bf58a8f56cad829b2263797a7e25e4')).toBe('stage://channel/47bf58a8f56cad829b2263797a7e25e4');
    expect(r('stage://0x1234567890123456789012345678901234567890')).toBe('stage://0x1234567890123456789012345678901234567890');
    expect(r('https://stage.box/#/0x1234567890123456789012345678901234567890')).toBe(
      'https://stage.box/#/0x1234567890123456789012345678901234567890',
    );
  });
});
