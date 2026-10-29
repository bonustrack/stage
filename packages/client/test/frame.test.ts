import { describe, expect, test } from 'bun:test';
import { decodeJsonContent, encodeJsonContent } from '../src/xmtp/codecs';
import {
  FRAME_ACTION_CONTENT_TYPE,
  FRAME_CONTENT_TYPE,
  frameActionFallbackText,
  frameActionText,
  frameFallbackText,
  frameStartSurface,
  frameSummaryOf,
  type FrameActionContent,
  type FrameContent,
} from '../src/xmtp/frame';
import { FRAME_MAX_CHARS, frameActionSchema, frameContentSchema } from '../src/xmtp/frame.schema';
import { mapDecodedToEnvelope } from '../src/xmtp/envelope';
import { previewOfXmtpContent } from '../src/xmtp/humanize';

const NS = 1_717_000_000_000 * 1_000_000;

const KIT = 'https://kit.stage.box/a2ui/v1_0/catalog.json';
const surface = (surfaceId: string, components: Record<string, unknown>[]) => ({
  version: 'v1.0',
  createSurface: { surfaceId, catalogId: KIT, components },
});
const MESSAGES = [surface('report', [{ id: 'root', component: 'Title', text: 'Weekly report' }])];

const frame: FrameContent = { title: 'Weekly report', description: 'Sales up 12%', messages: MESSAGES };

const TAP = {
  name: 'report.approve',
  surfaceId: 'report',
  sourceComponentId: 'approve',
  timestamp: '2026-10-26T00:00:00.000Z',
  context: { week: 39 },
};

const action: FrameActionContent = { frameId: 'msg-frame-1', action: TAP, label: 'Approve' };

describe('frame content types', () => {
  test('ids live under stage.box', () => {
    expect(FRAME_CONTENT_TYPE).toEqual({ authorityId: 'stage.box', typeId: 'frame', versionMajor: 2, versionMinor: 0 });
    expect(FRAME_ACTION_CONTENT_TYPE.versionMajor).toBe(2);
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
    const decoded = frameContentSchema.parse({ title: `  ${'t'.repeat(300)}  `, description: 'd'.repeat(2000), messages: MESSAGES });
    expect(decoded.title).toHaveLength(200);
    expect(decoded.description).toHaveLength(1000);
  });

  test('a frame is a list of A2UI v1.0 surface messages within its limits', () => {
    const big = [surface('a', [{ id: 'root', component: 'Text', text: 'x'.repeat(FRAME_MAX_CHARS) }])];
    const many = [
      surface(
        'a',
        Array.from({ length: 501 }, (_, i) => ({ id: `c${i}`, component: 'Text', text: '' })),
      ),
    ];
    for (const messages of [
      [],
      {},
      'Card',
      [{ type: 'Card' }],
      [{ version: 'v0.9', createSurface: { surfaceId: 'a' } }],
      [{ version: 'v1.0' }],
      [{ version: 'v1.0', createSurface: { surfaceId: 'a' }, updateComponents: { surfaceId: 'a', components: [] } }],
      [{ version: 'v1.0', callRendererFunction: { surfaceId: 'a' } }],
      [{ version: 'v1.0', deleteSurface: {} }],
      big,
      many,
    ]) {
      const enc = encodeJsonContent(FRAME_CONTENT_TYPE, { messages });
      expect(() => decodeJsonContent(enc.content, frameContentSchema, 'xmtp.frame')).toThrow(/boundary:xmtp.frame/);
    }
    expect(frameContentSchema.safeParse({ widget: { type: 'Card' } }).success).toBe(false);
  });

  test('a frame starts on its named surface, else its first', () => {
    const two = [...MESSAGES, surface('details', [{ id: 'root', component: 'Text', text: 'More' }])];
    expect(frameStartSurface({ messages: two })).toBe('report');
    expect(frameStartSurface({ messages: two, start: 'details' })).toBe('details');
    expect(frameStartSurface({ messages: two, start: 'nope' })).toBe('report');
  });

  test('a summary reads the first title and the first other text of a surface', () => {
    const messages = [
      surface('s', [
        { id: 'root', component: 'Column', children: ['t', 'c', 'b'] },
        { id: 'c', component: 'Text', text: 'small', variant: 'caption' },
        { id: 't', component: 'Title', text: ' Order ' },
        { id: 'b', component: 'Text', text: { '@path': '/x' } },
      ]),
      { version: 'v1.0', updateComponents: { surfaceId: 's', components: [{ id: 'b', component: 'Text', text: 'Shipped' }] } },
    ];
    expect(frameSummaryOf({ messages })).toEqual({ title: 'Order', description: 'Shipped' });
    expect(frameSummaryOf({ messages: [surface('s', [{ id: 'root', component: 'Text', text: 'Only' }])] })).toEqual({ title: 'Only' });
  });

  test('a frame keeps a live source url and drops a malformed one without refusing the frame', () => {
    expect(frameContentSchema.parse({ messages: MESSAGES, source: { url: ' https://btc.example.com/ ' } })).toEqual({
      messages: MESSAGES,
      source: { url: 'https://btc.example.com/' },
    });
    for (const source of [{ url: '' }, { url: 7 }, 'https://btc.example.com/', { url: `https://x.com/${'a'.repeat(2100)}` }]) {
      expect(frameContentSchema.parse({ messages: MESSAGES, source }).source).toBeUndefined();
    }
  });

  test('a frame action is an A2UI action event for a frame id', () => {
    expect(frameActionSchema.safeParse({ action: TAP }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: { type: 'a' } }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: { ...TAP, context: [] } }).success).toBe(false);
    expect(frameActionSchema.safeParse({ frameId: 'f', action: { ...TAP, context: { big: 'x'.repeat(20_000) } } }).success).toBe(false);
    expect(frameActionSchema.parse({ frameId: 'f', action: TAP, dataModel: { report: { week: 39 } } }).dataModel).toEqual({
      report: { week: 39 },
    });
  });

  test('display texts', () => {
    expect(frameFallbackText({ messages: MESSAGES })).toBe('Frame');
    expect(frameActionText(action)).toBe('Tapped "Approve"');
    expect(frameActionText({ action: { name: 'pick' } })).toBe('Tapped pick');
    expect(frameActionText({ action: { name: 'pick', userMessage: 'Pick red' } })).toBe('Tapped "Pick red"');
    expect(frameActionFallbackText({ frameId: 'f', action: { ...TAP, name: 'pick', context: {} } })).toBe('Frame action: pick');
  });
});

describe('frame envelopes', () => {
  test('a decoded frame becomes an entry with the frame in its payload', () => {
    const e = mapDecodedToEnvelope(
      { id: 'msg-frame-1', senderInboxId: 'inbox-agent', sentNs: NS, contentTypeId: 'stage.box/frame:2.0', content: () => frame },
      'stage://xmtp/a/conv1',
    );
    expect(e.text).toBe('Frame: Weekly report\nSales up 12%');
    expect(e.payload).toEqual({ contentType: 'frame', frame });
  });

  test('a decoded frame action reads as a tap on its label and quotes its frame', () => {
    const e = mapDecodedToEnvelope(
      { id: 'msg-action-1', senderInboxId: 'inbox-less', sentNs: NS, contentTypeId: 'stage.box/frameAction:2.0', content: () => action },
      'stage://xmtp/a/conv1',
    );
    expect(e.text).toBe('Tapped "Approve"');
    expect(e.replyTo).toBe('msg-frame-1');
    expect(e.payload).toEqual({ contentType: 'frameAction', frameAction: action });
  });

  test('a frame whose codec failed falls back to its fallback text', () => {
    const e = mapDecodedToEnvelope(
      {
        id: 'msg-frame-2',
        senderInboxId: 'inbox-agent',
        sentNs: NS,
        contentTypeId: 'stage.box/frame:2.0',
        content: () => undefined,
        fallback: 'Frame: Broken',
      },
      'stage://xmtp/a/conv1',
    );
    expect(e.text).toBe('Frame: Broken');
    expect(e.payload).toEqual({ contentType: 'frame' });
  });
});

describe('frame chat-list previews', () => {
  test('a frame reads as its title, an action as a tap on its label or type', () => {
    expect(previewOfXmtpContent(frame, 'stage.box/frame:2.0')).toBe('Frame: Weekly report');
    expect(previewOfXmtpContent({ messages: [] }, 'stage.box/frame:2.0')).toBe('Frame');
    expect(previewOfXmtpContent(action, 'stage.box/frameAction:2.0')).toBe('Tapped "Approve"');
    expect(previewOfXmtpContent({ frameId: 'f', action: { name: 'pick' } }, 'stage.box/frameAction:2.0')).toBe('Tapped pick');
    expect(previewOfXmtpContent({ frameId: 'f', label: '', action: {} }, 'stage.box/frameAction:2.0')).toBe('[frame action]');
    expect(previewOfXmtpContent(null, 'stage.box/frameAction:2.0')).toBe('[frame action]');
    expect(previewOfXmtpContent({ frameId: 'f', label: '', action: { name: '', userMessage: ' ' } }, 'stage.box/frameAction:2.0')).toBe(
      '[frame action]',
    );
    expect(previewOfXmtpContent({ frameId: 'f', action: { name: 'book', userMessage: 'Book table' } }, 'stage.box/frameAction:2.0')).toBe(
      'Tapped "Book table"',
    );
  });
});
