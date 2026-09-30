
import { describe, expect, test } from 'bun:test';
import { convIdOfLine, lineOfConv, stageChannelIdOf, stageConvIdOf, stageDmPeerOf } from '../src/xmtp/line';

const CONV = '47bf58a8f56cad829b2263797a7e25e4';
const ADDR = '0x42e167e6bff0a3a701d8fa14f96a0f840eb939df';

describe('stageConvIdOf', () => {
  test('matches both app schemes', () => {
    expect(stageConvIdOf(`metro://xmtp/${CONV}`)).toBe(CONV);
    expect(stageConvIdOf(`stage://xmtp/${CONV}`)).toBe(CONV);
  });

  test('matches https permalinks, path- and hash-routed', () => {
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

describe('stageChannelIdOf', () => {
  test('recognizes whole supported channel URLs, including message and focus parameters', () => {
    for (const prefix of ['stage://', 'metro://', 'https://stage.box/', 'https://stage.box/#/', 'http://stage.box/']) {
      for (const path of ['channel', 'xmtp']) {
        expect(stageChannelIdOf(`${prefix}${path}/${CONV}`)).toBe(CONV);
        expect(stageChannelIdOf(`${prefix}${path}/${CONV}/?m=abc&focus=1`)).toBe(CONV);
      }
    }
  });

  test('does not confuse profile links, external hosts, partial links or punctuation with channels', () => {
    for (const url of [
      `stage://user/${ADDR}`, `stage://${ADDR}`, `stage://xmtp/user/${ADDR}`, `stage://xmtp/${ADDR}`,
      'stage://alice', 'https://stage.box/#/alice', `https://stage.box/user/${ADDR}`,
      `https://stage.box/#/profile/${CONV}`, `https://stage.box.evil/channel/${CONV}`,
      `https://example.com/?url=https://stage.box/channel/${CONV}`, `stage://channel/${CONV}/extra`,
      `see stage://channel/${CONV}`, `stage://channel/${CONV}.`, `stage://channel/${CONV})`,
      `stage://channel/${CONV}?next=#/%`, `https://stage.box/#/channel/${CONV}?next=#/%`,
      `stage://channel/${CONV}?next=#/other`, `stage://channel/${CONV}#/%`,
      'stage://channel/%E0%A4', 'https://stage.box/#/channel/%',
    ]) expect(stageChannelIdOf(url)).toBeNull();
  });
});

describe('stageDmPeerOf', () => {
  test('matches both app schemes', () => {
    expect(stageDmPeerOf(`metro://xmtp/user/${ADDR}`)).toBe(ADDR);
    expect(stageDmPeerOf(`stage://xmtp/user/${ADDR}`)).toBe(ADDR);
  });

  test('matches https user links (xmtp/user and bare user)', () => {
    expect(stageDmPeerOf(`https://stage.box/user/${ADDR}`)).toBe(ADDR);
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
