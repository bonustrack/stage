
import { describe, expect, test } from 'bun:test';
import {
  mapDecodedToEnvelope, envelopeFromContent, type EnvelopeOptions,
} from '../src/xmtp/envelope';
import type { HistoryEntry } from '../src/types';
import {
  textMessage, reactionMessage, voteReaction, throwingCodec,
} from './fixtures/decoded-messages';

const LINE = 'metro://xmtp/tony/conv1';

describe('mapDecodedToEnvelope', () => {
  test('plain text maps to a text entry with xmtp station + user-prefixed from', () => {
    const e = mapDecodedToEnvelope(textMessage, LINE);
    expect(e.station).toBe('xmtp');
    expect(e.line).toBe(LINE);
    expect(e.text).toBe('hello world');
    expect(e.from).toContain('inbox-alice');
    expect(e.payload?.contentType).toBe('text');
    expect(typeof e.ts).toBe('string');
    expect(e.ts).toContain('2024');
  });

  test('unicode reaction surfaces emoji + reactTo, not a vote', () => {
    const e = mapDecodedToEnvelope(reactionMessage, LINE);
    expect(e.payload?.emoji).toBe('👍');
    expect(e.payload?.reactTo).toBe('msg-text-1');
    expect(e.payload?.schema).toBeUndefined();
  });

  test('custom-schema reaction is decoded as a poll VOTE', () => {
    const e = mapDecodedToEnvelope(voteReaction, LINE);
    expect(e.payload?.schema).toBe('custom');
    expect(e.payload?.voteFor).toBe('poll-msg-1');
    expect(e.payload?.optionIndex).toBe(1);
  });

  test('unavailable codec degrades to fallback - does NOT throw', () => {
    let e: ReturnType<typeof mapDecodedToEnvelope> | undefined;
    expect(() => { e = mapDecodedToEnvelope(throwingCodec, LINE); }).not.toThrow();
    expect(e?.text).toContain('somethingNew');
    expect(e?.payload?.contentType).toBe('somethingNew');
  });
});

describe('envelopeFromContent ui-parity options', () => {
  const base: HistoryEntry = {
    id: 'i', ts: '2024-01-01T00:00:00.000Z', station: 'xmtp', line: 'l', from: 'f', to: 'l', messageId: 'i',
  };
  const uiOptions: EnvelopeOptions = {
    reactionRemoved: (a) => a === 2 || a === 'removed',
    reactionCustom: (s) => s === 3 || s === 'custom',
    reactionCustomPayloadExtras: false,
    replyReferenceOf: (d) => (d as { referenceId: string }).referenceId,
    replyTextOf: (d) => { const c = (d as { content: unknown }).content; return typeof c === 'string' ? c : undefined; },
    attachmentNameOf: (d) => (d as { filename?: string }).filename,
    attachmentLabelOf: (d) => (d as { filename?: string }).filename ?? 'attachment',
    attachmentDataB64Of: () => 'B64',
    handlers: new Set(['reaction', 'reply', 'attachment', 'poll', 'walletSendCalls', 'signatureRequest']),
    requireObjectForHandlers: true,
  };

  test('reply uses referenceId + string content', () => {
    const e = envelopeFromContent(base, 'reply', { referenceId: 'r1', content: 'hi' }, undefined, uiOptions);
    expect(e.replyTo).toBe('r1');
    expect(e.text).toBe('hi');
    expect(e.payload).toEqual({ contentType: 'reply', replyTo: 'r1' });
  });

  test('custom reaction omits voteFor/optionIndex and detects numeric enum schema', () => {
    const e = envelopeFromContent(base, 'reaction', { action: 1, schema: 3, content: '0:1', reference: 'p1' }, undefined, uiOptions);
    expect(e.payload).toEqual({ contentType: 'reaction', reactTo: 'p1', emoji: '0:1', schema: 'custom', removed: false });
  });

  test('unnamed attachment: payload name undefined, text label falls back', () => {
    const e = envelopeFromContent(base, 'attachment', { mimeType: 'image/png', content: new Uint8Array() }, undefined, uiOptions);
    expect(e.text).toBe('[image: attachment]');
    expect((e.payload as { attachments: { name?: string }[] }).attachments[0]?.name).toBeUndefined();
  });

  test('null content with object-guard degrades to fallback, does not throw', () => {
    const e = envelopeFromContent(base, 'reaction', null, 'fb', uiOptions);
    expect(e.text).toBe('fb');
    expect(e.payload).toEqual({ contentType: 'reaction' });
  });

  test('unhandled type with group-update typeId still systemizes', () => {
    const e = envelopeFromContent(base, 'group_updated', { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], metadataFieldChanges: [] }, undefined, uiOptions);
    expect(e.payload).toEqual({ contentType: 'group_updated', system: true });
  });
});
