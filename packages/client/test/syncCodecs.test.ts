import { describe, expect, test } from 'bun:test';
import { STAGE_JSON_CODECS, SYNC_CODECS } from '../src/xmtp/jsonCodecs';
import { isSyncType, type SyncKind } from '../src/xmtp/readState';

const WIRE: Record<SyncKind, { typeId: string; fallback: string; json: string }> = {
  read: {
    typeId: 'readState', fallback: 'Stage read state',
    json: '{"convId":"c1","lastReadNs":1700000000000000000,"markedUnread":false,"at":1759500000000}',
  },
  pin: { typeId: 'pinState', fallback: 'Stage pin state', json: '{"convId":"c1","pinned":true,"order":["c1","c2"],"at":1759500000001}' },
  clear: { typeId: 'clearState', fallback: 'Stage deleted chats', json: '{"cleared":{"0xabc":1759500000002}}' },
  board: { typeId: 'boardState', fallback: 'Stage board layout', json: '{"order":["label:Todo","label:Done"],"at":1759500000003}' },
  categoryOrder: {
    typeId: 'categoryOrderState', fallback: 'Stage category order', json: '{"order":["category:work","category:home"],"at":1759500000004}',
  },
  search: { typeId: 'searchState', fallback: 'Stage search', json: '{"query":"","labels":["work"],"unreadOnly":true,"at":1759500000005}' },
  homeView: {
    typeId: 'homeView', fallback: 'Stage home view', json: '{"view":"chats","groupBy":"category","columnBy":"label","at":1759500000006}',
  },
};

const OLD_REGISTRY = [
  'metro.box/poll:1.0:true', 'metro.box/signatureRequest:1.0:true', 'metro.box/signatureReference:1.0:true',
  'xmtp.org/walletSendCalls:1.0:true', 'stage.box/readState:1.0:false', 'stage.box/pinState:1.0:false',
  'stage.box/clearState:1.0:false', 'stage.box/boardState:1.0:false', 'stage.box/categoryOrderState:1.0:false',
  'stage.box/searchState:1.0:false', 'stage.box/homeView:1.0:false', 'stage.box/callInvite:1.0:true',
  'stage.box/callSignal:1.0:false', 'stage.box/frame:1.0:true', 'stage.box/frameAction:1.0:true', 'stage.box/deleteRequest:1.0:false',
];

describe('device sync wire format', () => {
  for (const [kind, wire] of Object.entries(WIRE)) {
    test(`${kind} encodes to the same bytes as before and decodes old payloads`, () => {
      const codec = SYNC_CODECS[kind as SyncKind];
      const old = new TextEncoder().encode(wire.json);
      const decoded = codec.decode({ content: old });
      expect(decoded).toEqual(JSON.parse(wire.json));
      const encoded = codec.encode(JSON.parse(wire.json));
      expect(encoded.type).toEqual({ authorityId: 'stage.box', typeId: wire.typeId, versionMajor: 1, versionMinor: 0 });
      expect(encoded.parameters).toEqual({});
      expect(encoded.fallback).toBe(wire.fallback);
      expect(encoded.content).toEqual(old);
      expect(codec.shouldPush()).toBe(false);
      expect(isSyncType(`stage.box/${wire.typeId}:1.0`, kind as SyncKind)).toBe(true);
      expect(isSyncType(`stage.box/${wire.typeId}:1.0`)).toBe(true);
    });
  }

  test('registers the same codecs in the same order, and other types are not sync state', () => {
    const ids = STAGE_JSON_CODECS.map(({ contentType: t, shouldPush }) => `${t.authorityId}/${t.typeId}:${t.versionMajor}.${t.versionMinor}:${shouldPush()}`);
    expect(ids).toEqual(OLD_REGISTRY);
    expect(isSyncType('stage.box/frame:1.0')).toBe(false);
    expect(isSyncType(undefined)).toBe(false);
  });
});
