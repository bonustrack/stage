/** Tests for the brand- and scheme-agnostic line helpers. A channel/DM link must
 *  resolve identically whether it arrives as the Metro or Stage app scheme
 *  (metro:// / stage://) or as an https permalink on either host (metro.box /
 *  stage.box, path- or hash-routed). These detectors back the inline message
 *  cards, so they run on every bubble render. */

import { describe, expect, test } from 'bun:test';
import { metroConvIdOf, metroDmPeerOf } from '../src/xmtp/line';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';
const ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';

describe('metroConvIdOf', () => {
  test('matches both app schemes', () => {
    expect(metroConvIdOf(`metro://xmtp/${CONV}`)).toBe(CONV);
    expect(metroConvIdOf(`stage://xmtp/${CONV}`)).toBe(CONV);
  });

  test('matches https permalinks on both hosts, path- and hash-routed', () => {
    expect(metroConvIdOf(`https://metro.box/xmtp/${CONV}`)).toBe(CONV);
    expect(metroConvIdOf(`https://stage.box/xmtp/${CONV}`)).toBe(CONV);
    expect(metroConvIdOf(`https://stage.box/#/xmtp/${CONV}?m=1`)).toBe(CONV);
  });

  test('matches a link embedded mid-text', () => {
    expect(metroConvIdOf(`see metro://xmtp/${CONV} here`)).toBe(CONV);
  });

  test('does NOT read the DM user form as a conv id', () => {
    expect(metroConvIdOf(`metro://xmtp/user/${ADDR}`)).toBeNull();
    expect(metroConvIdOf(`https://stage.box/xmtp/user/${ADDR}`)).toBeNull();
  });

  test('null for non-links', () => {
    expect(metroConvIdOf('just text')).toBeNull();
    expect(metroConvIdOf(null)).toBeNull();
  });
});

describe('metroDmPeerOf', () => {
  test('matches both app schemes', () => {
    expect(metroDmPeerOf(`metro://xmtp/user/${ADDR}`)).toBe(ADDR);
    expect(metroDmPeerOf(`stage://xmtp/user/${ADDR}`)).toBe(ADDR);
  });

  test('matches https user links on both hosts (xmtp/user and bare user)', () => {
    expect(metroDmPeerOf(`https://metro.box/xmtp/user/${ADDR}`)).toBe(ADDR);
    expect(metroDmPeerOf(`https://stage.box/user/${ADDR}`)).toBe(ADDR);
    expect(metroDmPeerOf(`https://metro.box/#/user/${ADDR}`)).toBe(ADDR);
  });

  test('matches a link embedded mid-text', () => {
    expect(metroDmPeerOf(`ping https://stage.box/user/${ADDR} thanks`)).toBe(ADDR);
  });

  test('null when no DM link present', () => {
    expect(metroDmPeerOf(`metro://xmtp/${CONV}`)).toBeNull();
    expect(metroDmPeerOf(null)).toBeNull();
  });
});
