import { describe, expect, test } from 'bun:test';
import { envelopeOf } from '../src/xmtp/envelope';
import { textMessage, reactionMessage, voteReaction, undecodableMessage, xmtpMessage } from './fixtures/decoded-messages';

const LINE = 'stage://xmtp/tony/conv1';

const base = {
  id: 'msg-1',
  ts: new Date(1_717_000_000_000).toISOString(),
  station: 'xmtp',
  line: LINE,
  from: 'stage://xmtp/user/inbox-alice',
  to: LINE,
  messageId: 'msg-1',
};

describe('envelopeOf', () => {
  test('plain text maps to a text entry with xmtp station + user-prefixed from', () => {
    const e = envelopeOf(textMessage, LINE);
    expect(e.station).toBe('xmtp');
    expect(e.line).toBe(LINE);
    expect(e.text).toBe('hello world');
    expect(e.from).toBe('stage://xmtp/user/inbox-alice');
    expect(e.payload).toEqual({ contentType: 'text' });
    expect(e.ts).toBe('2024-05-29T16:26:40.000Z');
  });

  test('unicode reaction surfaces emoji + reactTo, not a vote', () => {
    const e = envelopeOf(reactionMessage, LINE);
    expect(e.text).toBe('[react 👍]');
    expect(e.payload).toEqual({ contentType: 'reaction', reactTo: 'msg-text-1', emoji: '👍', removed: false });
  });

  test('custom-schema reaction is decoded as a poll VOTE', () => {
    const e = envelopeOf(voteReaction, LINE);
    expect(e.text).toBe('[vote 1]');
    expect(e.payload).toEqual({ contentType: 'reaction', reactTo: 'poll-msg-1', emoji: '1', schema: 'custom', removed: false });
  });

  test('a removed reaction says so', () => {
    const removed = xmtpMessage({ contentTypeId: 'reaction', content: { reference: 'p1', content: '0:1', removed: true, custom: true } });
    expect(envelopeOf(removed, LINE)).toMatchObject({ text: '[vote 0:1 (removed)]', payload: { removed: true, schema: 'custom' } });
  });

  test('undecodable content degrades to its type, not its fallback', () => {
    const e = envelopeOf(undecodableMessage, LINE);
    expect(e.text).toBe('[somethingNew payload]');
    expect(e.payload).toEqual({ contentType: 'somethingNew' });
  });

  test('a leave request reads as a system line even when its codec is missing', () => {
    const e = envelopeOf({ ...undecodableMessage, contentTypeId: 'leave_request' }, LINE);
    expect(e.text).toBe('left the channel');
    expect(e.payload).toEqual({ contentType: 'leave_request', system: true });
  });
});

describe('envelopeOf per content type', () => {
  const at = (contentTypeId: string, content: unknown, fallback?: string) =>
    envelopeOf(xmtpMessage({ contentTypeId, content, ...(fallback === undefined ? {} : { fallback }) }), LINE);

  test('reply keeps its reference and text', () => {
    const e = at('reply', { reference: 'r1', text: 'hi' });
    expect(e.replyTo).toBe('r1');
    expect(e.text).toBe('hi');
    expect(e.payload).toEqual({ contentType: 'reply', replyTo: 'r1' });
  });

  const remote = {
    url: 'https://store.example/encrypted',
    filename: 'message.txt',
    contentDigest: 'digest',
    secret: 'secret',
    salt: 'salt',
    nonce: 'nonce',
    contentLength: '4097',
    scheme: 'https://',
  };

  test('single-remote replies keep both the file and reference', () => {
    const e = at('reply', { reference: 'original', remote }, 'fallback');
    expect(e.text).toBe('[file: message.txt]');
    expect(e.replyTo).toBe('original');
    expect(e.payload).toEqual({ contentType: 'reply', replyTo: 'original', attachments: [{ kind: 'file', name: 'message.txt', remote }] });
  });

  test('single-remote replies keep typed byte metadata', () => {
    const info = { ...remote, secret: new Uint8Array([1]), salt: new Uint8Array([2]), nonce: new Uint8Array([3]), contentLength: 4097 };
    const e = at('reply', { reference: 'original', remote: info }, 'fallback');
    expect(e.text).toBe('[file: message.txt]');
    expect(e.payload).toEqual({
      contentType: 'reply',
      replyTo: 'original',
      attachments: [{ kind: 'file', name: 'message.txt', remote: info }],
    });
  });

  test.each([
    { ...remote, secret: undefined },
    { ...remote, nonce: 42 },
    { ...remote, filename: 42 },
    { filename: 'message.txt', content: new Uint8Array([1]) },
    { attachments: [remote] },
  ])('an incomplete or undecodable file reply keeps its reference and fallback', (content) => {
    const e = at('reply', { reference: 'original', remote: content }, 'fallback');
    expect(e.replyTo).toBe('original');
    expect(e.text).toBe('fallback');
    expect(e.payload?.attachments).toBeUndefined();
  });

  test('a reply with no text and no file reads as its fallback, then as a reply', () => {
    expect(at('reply', { reference: 'r9' }, 'inner fallback')).toMatchObject({ text: 'inner fallback', replyTo: 'r9' });
    expect(at('reply', { reference: '' }).text).toBe('[reply]');
  });

  test('inline attachment: payload name undefined, text label falls back', () => {
    const e = at('attachment', { mimeType: 'image/png', dataB64: 'AAAA' });
    expect(e.text).toBe('[image: attachment]');
    expect(e.payload).toEqual({
      contentType: 'attachment',
      attachments: [{ kind: 'image', mime: 'image/png', name: undefined, dataB64: 'AAAA' }],
    });
  });

  test('multi remote attachments name unnamed files by position', () => {
    const e = at('multiRemoteStaticAttachment', { attachments: [{ url: 'a' }, { url: 'b', filename: 'b.mp4' }] });
    expect(e.text).toBe('[2 attachments]');
    expect(e.payload?.attachments).toEqual([
      { kind: 'file', name: 'attachment-1', remote: { url: 'a' } },
      { kind: 'video', name: 'b.mp4', remote: { url: 'b', filename: 'b.mp4' } },
    ]);
  });

  test('null content degrades to fallback, does not throw', () => {
    const e = at('reaction', null, 'fb');
    expect(e.text).toBe('fb');
    expect(e.payload).toEqual({ contentType: 'reaction' });
  });

  test('a group update systemizes', () => {
    const update = { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], metadataFieldChanges: [] };
    expect(at('group_updated', update).payload).toEqual({ contentType: 'group_updated', system: true, groupUpdate: update });
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
      const e = at('group_updated', groupUpdate);
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
    expect(at('callInvite', invite, 'fb')).toMatchObject({ text: 'fb', payload: { contentType: 'callInvite', callInvite: invite } });
    expect(at('callSignal', signal, 'fb').payload).toEqual({ contentType: 'callSignal', callSignal: signal });
    expect(at('callInvite', { callId: 'x' }, 'fb').payload).toEqual({ contentType: 'callInvite' });
  });

  test('a leave request and a left member read as plain words', () => {
    expect(at('leave_request', {}).text).toBe('left the channel');
    const update = { initiatedByInboxId: 'x', addedInboxes: [], removedInboxes: [], leftInboxes: [{ inboxId: 'y' }] };
    expect(at('group_updated', update).text).toBe('1 member left the channel');
  });
});
