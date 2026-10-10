import { describe, expect, test } from 'bun:test';
import { decodeJsonContent, encodeJsonContent } from '../src/xmtp/codecs';
import {
  FRAME_ACTION_CONTENT_TYPE, FRAME_CONTENT_TYPE, frameActionFallbackText, frameActionText, frameFallbackText,
  type FrameActionContent, type FrameContent,
} from '../src/xmtp/frame';
import { FRAME_MAX_CHARS, frameActionSchema, frameContentSchema } from '../src/xmtp/frame.schema';
import { mapDecodedToEnvelope } from '../src/xmtp/envelope';
import { previewOfXmtpContent } from '../src/xmtp/humanize';

const NS = 1_717_000_000_000 * 1_000_000;

const frame: FrameContent = {
  title: 'Weekly report',
  description: 'Sales up 12%',
  widget: { type: 'Card', children: [{ type: 'Title', value: 'Weekly report' }] },
};

const action: FrameActionContent = {
  frameId: 'msg-frame-1',
  action: { type: 'report.approve', payload: { week: 39 } },
  label: 'Approve',
};

describe('frame content types', () => {
  test('ids live under stage.box', () => {
    expect(FRAME_CONTENT_TYPE).toEqual({ authorityId: 'stage.box', typeId: 'frame', versionMajor: 1, versionMinor: 0 });
    expect(FRAME_ACTION_CONTENT_TYPE.typeId).toBe('frameAction');
  });

  test('a frame survives an encode and a validated decode', () => {
    const enc = encodeJsonContent(FRAME_CONTENT_TYPE, frame, frameFallbackText(frame));
    expect(enc.fallback).toBe('Frame: Weekly report\nSales up 12%');
    expect(decodeJsonContent(enc.content, frameContentSchema, 'xmtp.frame')).toEqual(frame);
  });

  test('a frame action survives an encode and a validated decode', () => {
    const enc = encodeJsonContent(FRAME_ACTION_CONTENT_TYPE, action, frameActionFallbackText(action));
    expect(enc.fallback).toBe('Frame action: report.approve {"week":39}');
    expect(decodeJsonContent(enc.content, frameActionSchema, 'xmtp.frameAction')).toEqual(action);
  });

  test('title and description are trimmed and cut, not refused', () => {
    const decoded = frameContentSchema.parse({ title: `  ${'t'.repeat(300)}  `, description: 'd'.repeat(2000), widget: { type: 'Card' } });
    expect(decoded.title).toHaveLength(200);
    expect(decoded.description).toHaveLength(1000);
  });

  test('a widget without a type, a non-object widget or an oversized widget is refused', () => {
    for (const widget of [{}, { type: '' }, 'Card', [], { type: 'Card', children: [{ type: 'Text', value: 'x'.repeat(FRAME_MAX_CHARS) }] }]) {
      const enc = encodeJsonContent(FRAME_CONTENT_TYPE, { widget });
      expect(() => decodeJsonContent(enc.content, frameContentSchema, 'xmtp.frame')).toThrow(/boundary:xmtp.frame/);
    }
  });

  test('a frame holds a widget or up to 50 screens, not both', () => {
    const card = { type: 'Card' };
    const screens = { home: card, s1: { title: ' Story ', widget: card } };
    expect(frameContentSchema.parse({ screens, start: 'home' })).toEqual({ screens: { home: card, s1: { title: 'Story', widget: card } }, start: 'home' });
    for (const bad of [
      {}, { widget: card, screens }, { screens: {} }, { screens: { '': card } }, { screens: { home: { type: '' } } },
      { screens: Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`s${i}`, card])) },
      { screens: { a: { type: 'Text', value: 'x'.repeat(FRAME_MAX_CHARS / 2) }, b: { type: 'Text', value: 'x'.repeat(FRAME_MAX_CHARS / 2) } } },
    ]) expect(frameContentSchema.safeParse(bad).success).toBe(false);
  });

  test('a frame keeps a live source url and drops a malformed one without refusing the frame', () => {
    const card = { type: 'Card' };
    expect(frameContentSchema.parse({ widget: card, source: { url: ' https://btc.example.com/ ' } }))
      .toEqual({ widget: card, source: { url: 'https://btc.example.com/' } });
    for (const source of [{ url: '' }, { url: 7 }, 'https://btc.example.com/', { url: `https://x.com/${'a'.repeat(2100)}` }]) {
      expect(frameContentSchema.parse({ widget: card, source }).source).toBeUndefined();
    }
  });

  test('a frame action needs a frame id and an action type', () => {
    expect(frameActionSchema.safeParse({ action: { type: 'a' } }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: {} }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: { type: 'a', payload: [] } }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: { type: 'a', payload: { big: 'x'.repeat(20_000) } } }).success).toBe(false);
  });

  test('display texts', () => {
    expect(frameFallbackText({ widget: { type: 'Card' } })).toBe('Frame');
    expect(frameActionText(action)).toBe('Approve');
    expect(frameActionText({ frameId: 'f', action: { type: 'pick' } })).toBe('pick');
    expect(frameActionFallbackText({ frameId: 'f', action: { type: 'pick' } })).toBe('Frame action: pick');
  });
});

describe('frame envelopes', () => {
  test('a decoded frame becomes an entry with the frame in its payload', () => {
    const e = mapDecodedToEnvelope({
      id: 'msg-frame-1', senderInboxId: 'inbox-agent', sentNs: NS,
      contentTypeId: 'stage.box/frame:1.0', content: () => frame,
    }, 'stage://xmtp/a/conv1');
    expect(e.text).toBe('Frame: Weekly report\nSales up 12%');
    expect(e.payload).toEqual({ contentType: 'frame', frame });
  });

  test('a decoded frame action reads as its label', () => {
    const e = mapDecodedToEnvelope({
      id: 'msg-action-1', senderInboxId: 'inbox-less', sentNs: NS,
      contentTypeId: 'stage.box/frameAction:1.0', content: () => action,
    }, 'stage://xmtp/a/conv1');
    expect(e.text).toBe('Approve');
    expect(e.payload).toEqual({ contentType: 'frameAction', frameAction: action });
  });

  test('a frame whose codec failed falls back to its fallback text', () => {
    const e = mapDecodedToEnvelope({
      id: 'msg-frame-2', senderInboxId: 'inbox-agent', sentNs: NS,
      contentTypeId: 'stage.box/frame:1.0', content: () => undefined, fallback: 'Frame: Broken',
    }, 'stage://xmtp/a/conv1');
    expect(e.text).toBe('Frame: Broken');
    expect(e.payload).toEqual({ contentType: 'frame' });
  });
});

describe('frame chat-list previews', () => {
  test('a frame reads as its title, an action as its label or type', () => {
    expect(previewOfXmtpContent(frame, 'stage.box/frame:1.0')).toBe('Frame: Weekly report');
    expect(previewOfXmtpContent({ widget: {} }, 'stage.box/frame:1.0')).toBe('Frame');
    expect(previewOfXmtpContent(action, 'stage.box/frameAction:1.0')).toBe('Approve');
    expect(previewOfXmtpContent({ frameId: 'f', action: { type: 'pick' } }, 'stage.box/frameAction:1.0')).toBe('pick');
    expect(previewOfXmtpContent(null, 'stage.box/frameAction:1.0')).toBe('[frame action]');
  });
});
