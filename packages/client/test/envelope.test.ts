import { describe, expect, mock, test } from 'bun:test';
import { mapDecodedToEnvelope, envelopeFromContent, type EnvelopeOptions } from '../src/xmtp/envelope';
import type { HistoryEntry } from '../src/types';
import { textMessage, reactionMessage, voteReaction, throwingCodec } from './fixtures/decoded-messages';

const LINE = 'stage://xmtp/tony/conv1';

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
    expect(() => {
      e = mapDecodedToEnvelope(throwingCodec, LINE);
    }).not.toThrow();
    expect(e?.text).toContain('somethingNew');
    expect(e?.payload?.contentType).toBe('somethingNew');
  });

  test('a leave request reads as a system line even when its codec is missing', () => {
    const leave = { ...throwingCodec, contentTypeId: 'xmtp.org/leave_request:1.0', fallback: undefined };
    const e = mapDecodedToEnvelope(leave, LINE);
    expect(e.text).toBe('left the channel');
    expect(e.payload).toEqual({ contentType: 'leave_request', system: true });
  });
});

describe('envelopeFromContent ui-parity options', () => {
  const base: HistoryEntry = { id: 'i', ts: '2024-01-01T00:00:00.000Z', station: 'xmtp', line: 'l', from: 'f', to: 'l', messageId: 'i' };
  const uiOptions: EnvelopeOptions = {
    reactionRemoved: (a) => a === 2 || a === 'removed',
    reactionCustom: (s) => s === 3 || s === 'custom',
    reactionCustomPayloadExtras: false,
    replyReferenceOf: (d) => (d as { referenceId: string }).referenceId,
    replyTextOf: (d) => {
      const c = (d as { content: unknown }).content;
      return typeof c === 'string' ? c : undefined;
    },
    attachmentNameOf: (d) => (d as { filename?: string }).filename,
    attachmentLabelOf: (d) => (d as { filename?: string }).filename ?? 'attachment',
    attachmentDataB64Of: () => 'B64',
    requireObjectForHandlers: true,
  };

  test('reply uses referenceId + string content', () => {
    const e = envelopeFromContent(base, 'reply', { referenceId: 'r1', content: 'hi' }, undefined, uiOptions);
    expect(e.replyTo).toBe('r1');
    expect(e.text).toBe('hi');
    expect(e.payload).toEqual({ contentType: 'reply', replyTo: 'r1' });
  });

  const nativeRemote = {
    url: 'https://store.example/encrypted',
    filename: 'message.txt',
    contentDigest: 'digest',
    secret: 'secret',
    salt: 'salt',
    nonce: 'nonce',
    contentLength: '4097',
    scheme: 'https://',
  };

  test('legacy native single-remote replies keep both the file and reference', () => {
    const e = envelopeFromContent(base, 'reply', { reference: 'original', content: { remoteAttachment: nativeRemote } }, 'fallback');
    expect(e.text).toBe('[file: message.txt]');
    expect(e.replyTo).toBe('original');
    expect(e.payload).toEqual({
      contentType: 'reply',
      replyTo: 'original',
      attachments: [{ kind: 'file', name: 'message.txt', remote: nativeRemote }],
    });
  });

  test('browser single-remote replies preserve typed metadata without calling the asynchronous type resolver', () => {
    const info = {
      ...nativeRemote,
      secret: new Uint8Array([1]),
      salt: new Uint8Array([2]),
      nonce: new Uint8Array([3]),
      contentLength: 4097,
    };
    const contentType = mock(async () => ({ typeId: 'remoteStaticAttachment' }));
    const e = envelopeFromContent(base, 'reply', { referenceId: 'original', content: info, contentType }, 'fallback', uiOptions);
    expect(e.text).toBe('[file: message.txt]');
    expect(e.replyTo).toBe('original');
    expect(e.payload).toEqual({
      contentType: 'reply',
      replyTo: 'original',
      attachments: [{ kind: 'file', name: 'message.txt', remote: info }],
    });
    expect(contentType).not.toHaveBeenCalled();
  });

  test.each([
    { ...nativeRemote, secret: undefined },
    { ...nativeRemote, nonce: 42 },
    { ...nativeRemote, filename: 42 },
    { filename: 'message.txt', content: new Uint8Array([1]) },
    { attachments: [nativeRemote] },
  ])('an incomplete or undecodable file reply keeps its reference and fallback', (content) => {
    const e = envelopeFromContent(base, 'reply', { referenceId: 'original', content }, 'fallback', uiOptions);
    expect(e.replyTo).toBe('original');
    expect(e.text).toBe('fallback');
    expect(e.payload?.attachments).toBeUndefined();
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
    const update = { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], metadataFieldChanges: [] };
    const e = envelopeFromContent(base, 'group_updated', update, undefined, uiOptions);
    expect(e.payload).toEqual({ contentType: 'group_updated', system: true, groupUpdate: update });
  });

  test('description notices preserve the original sender and complete event envelope for both SDK shapes', () => {
    const change = {
      fieldName: 'app_data',
      oldValue: JSON.stringify({ description: 'Before' }),
      newValue: JSON.stringify({ description: 'Private after' }),
    };
    for (const groupUpdate of [
      { initiatedByInboxId: 'initiator', metadataFieldsChanged: [change] },
      { initiatedByInboxId: 'initiator', metadataFieldChanges: [change] },
    ]) {
      const e = envelopeFromContent(base, 'group_updated', groupUpdate, undefined, uiOptions);
      expect(e).toEqual({
        ...base,
        text: 'updated the channel description',
        payload: { contentType: 'group_updated', system: true, groupUpdate },
      });
      expect(e.payload?.groupUpdate).toBe(groupUpdate);
    }
  });

  test('call invites and signals keep their parsed content for the call card', () => {
    const invite = { callId: 'call-0001', from: 'peer-aaaa', video: false };
    const signal = { kind: 'join', callId: 'call-0001', from: 'peer-bbbb' };
    expect(envelopeFromContent(base, 'callInvite', invite, 'fb', uiOptions)).toMatchObject({
      text: 'fb',
      payload: { contentType: 'callInvite', callInvite: invite },
    });
    expect(envelopeFromContent(base, 'callSignal', signal, 'fb', uiOptions).payload).toEqual({
      contentType: 'callSignal',
      callSignal: signal,
    });
    expect(envelopeFromContent(base, 'callInvite', { callId: 'x' }, 'fb', uiOptions).payload).toEqual({ contentType: 'callInvite' });
  });

  test('a leave request and a left member read as plain words', () => {
    expect(envelopeFromContent(base, 'leave_request', {}, undefined, uiOptions).text).toBe('left the channel');
    const update = { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], leftInboxes: [{ inboxId: 'y' }] };
    expect(envelopeFromContent(base, 'group_updated', update, undefined, uiOptions).text).toBe('1 member left the channel');
  });

  test('reply whose inner content fails to decode falls back instead of throwing', () => {
    const throwing: EnvelopeOptions = {
      ...uiOptions,
      replyTextOf: () => {
        throw new Error('undecodable inner content');
      },
    };
    let e: HistoryEntry | undefined;
    expect(() => {
      e = envelopeFromContent(base, 'reply', { referenceId: 'r9' }, 'inner fallback', throwing);
    }).not.toThrow();
    expect(e?.text).toBe('inner fallback');
    expect(e?.replyTo).toBe('r9');
  });

  test('reply with a throwing reference resolver still yields an entry', () => {
    const throwing: EnvelopeOptions = {
      ...uiOptions,
      replyReferenceOf: () => {
        throw new Error('bad reference');
      },
    };
    const e = envelopeFromContent(base, 'reply', { content: 'kept text' }, undefined, throwing);
    expect(e.text).toBe('kept text');
    expect(e.replyTo).toBe('');
  });

  test('a handler that throws mid-build degrades to fallback text, not a crash', () => {
    const throwing: EnvelopeOptions = {
      ...uiOptions,
      replyReferenceOf: () => {
        throw new Error('boom');
      },
      replyTextOf: () => {
        throw new Error('boom');
      },
    };
    let e: HistoryEntry | undefined;
    expect(() => {
      e = envelopeFromContent(base, 'reply', { anything: true }, 'xmtp fallback', throwing);
    }).not.toThrow();
    expect(e?.text).toBe('xmtp fallback');
  });
});
