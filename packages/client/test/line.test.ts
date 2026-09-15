
import { describe, expect, test } from 'bun:test';
import { convIdOfLine, lineOfConv, stageConvIdOf, stageDmPeerOf } from '../src/xmtp/line';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';
const ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';

describe('stageConvIdOf', () => {
  test('matches both app schemes', () => {
    expect(stageConvIdOf(`metro://xmtp/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`stage://xmtp/${CONV}`)).toBe(CONV);
  });

  test('matches https permalinks on both hosts, path- and hash-routed', () => {
    expect(stageConvIdOf(`https://metro.box/xmtp/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`https://stage.box/xmtp/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`https://stage.box/#/xmtp/${CONV}?m=1`)).toBe(CONV);
  });

  test('matches a link embedded mid-text', () => {
    expect(stageConvIdOf(`see metro://xmtp/${CONV} here`)).toBe(CONV);
  });

  test('does NOT read the DM user form as a conv id', () => {
    expect(stageConvIdOf(`metro://xmtp/user/${ADDR}`)).toBeNull();
    expect(stageConvIdOf(`https://stage.box/xmtp/user/${ADDR}`)).toBeNull();
  });

  test('matches the channel/ (no xmtp segment) conv form', () => {
    expect(stageConvIdOf(`stage://channel/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`metro://channel/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`https://stage.box/channel/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`https://stage.box/#/channel/${CONV}?m=1`)).toBe(CONV);
  });

  test('does NOT read a bare address as a conv id', () => {
    expect(stageConvIdOf(`stage://${ADDR}`)).toBeNull();
    expect(stageConvIdOf(`https://stage.box/#/${ADDR}`)).toBeNull();
  });

  test('null for non-links', () => {
    expect(stageConvIdOf('just text')).toBeNull();
    expect(stageConvIdOf(null)).toBeNull();
  });
});

describe('stageDmPeerOf', () => {
  test('matches both app schemes', () => {
    expect(stageDmPeerOf(`metro://xmtp/user/${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`stage://xmtp/user/${ADDR}`)).toBe(ADDR);
  });

  test('matches https user links on both hosts (xmtp/user and bare user)', () => {
    expect(stageDmPeerOf(`https://metro.box/xmtp/user/${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`https://stage.box/user/${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`https://metro.box/#/user/${ADDR}`)).toBe(ADDR);
  });

  test('matches the bare (no xmtp, no user segment) address form', () => {
    expect(stageDmPeerOf(`stage://${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`metro://${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`https://stage.box/${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`https://stage.box/#/${ADDR}?m=1`)).toBe(ADDR);
  });

  test('matches a link embedded mid-text', () => {
    expect(stageDmPeerOf(`ping https://stage.box/user/${ADDR} thanks`)).toBe(ADDR);
  });

  test('null when no DM link present', () => {
    expect(stageDmPeerOf(`metro://xmtp/${CONV}`)).toBeNull();
    expect(stageDmPeerOf(null)).toBeNull();
  });
});

describe('convIdOfLine', () => {
  test('reads the conv id back from a fresh line and from a legacy-scheme line', () => {
    expect(lineOfConv(CONV)).toBe(`stage://xmtp/${CONV}`);
    expect(convIdOfLine(lineOfConv(CONV))).toBe(CONV);
    expect(convIdOfLine(`metro://xmtp/${CONV}`)).toBe(CONV);
    expect(convIdOfLine(`stage://xmtp/user/${ADDR}`)).toBeNull();
  });
});
