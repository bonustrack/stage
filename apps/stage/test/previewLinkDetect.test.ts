
import { describe, expect, test } from 'bun:test';
import { previewLinkOf } from '../lib/previewLinkDetect';

const GROUP = '521df401-53f1-4413-b95a-c682dc054134';
const PROJECT = '1707f2db-c2b8-4c91-9341-27b1d57d355f';
const EXPO = `https://u.expo.dev/${PROJECT}/group/${GROUP}`;
const ENCODED = encodeURIComponent(EXPO);

describe('previewLinkOf', () => {
  test('metro:// dev-client link (raw inner url)', () => {
    const r = previewLinkOf(`metro://expo-development-client/?url=${EXPO}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('stage:// dev-client link', () => {
    const r = previewLinkOf(`stage://expo-development-client/?url=${EXPO}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('https preview-launcher form with percent-encoded inner url', () => {
    const r = previewLinkOf(`https://metro.box/preview-launcher.html?u=${ENCODED}`);
    expect(r?.groupId).toBe(GROUP);
    expect(r?.url).toBe(`https://metro.box/preview-launcher.html?u=${ENCODED}`);
  });

  test('https preview-launcher on stage.box host', () => {
    const r = previewLinkOf(`https://stage.box/preview-launcher.html?u=${ENCODED}`);
    expect(r?.groupId).toBe(GROUP);
  });

  test('null for unrelated links', () => {
    expect(previewLinkOf('https://example.com/foo')).toBeNull();
    expect(previewLinkOf(null)).toBeNull();
  });
});
