import { describe, expect, test } from 'bun:test';
import { ReactionAction, ReactionSchema } from '@xmtp/browser-sdk';
import { envelopeOf } from '@stage-labs/client/xmtp/envelope';
import { rowPreviewOf } from '@stage-labs/client/xmtp/contentTypes';
import { nativeGroupMetaPolicy, nativeInstallationCreatedAtMs, nativeMessageOf } from '../lib/xmtp.sdk.native.shapes';
import { webMessageOf } from '../lib/xmtp.sdk.web.message';
import { REMOTE_TEXT_FILE as remote } from './helpers';

const MS = 1_717_000_000_123;
const NS = MS * 1_000_000;
const LINE = 'stage://xmtp/conv1';

function native(contentTypeId: string, content: unknown, fallback?: string) {
  return nativeMessageOf({
    id: 'm1',
    senderInboxId: 'alice',
    sentNs: NS,
    contentTypeId,
    content: () => content,
    ...(fallback === undefined ? {} : { fallback }),
  });
}

function web(typeId: string, content: unknown, fallback?: string) {
  return webMessageOf({
    id: 'm1',
    senderInboxId: 'alice',
    sentAtNs: BigInt(NS),
    sentAt: new Date(MS),
    contentType: { typeId },
    content,
    ...(fallback === undefined ? {} : { fallback }),
  });
}

describe('one message shape from both SDKs', () => {
  test('both carry the short type id, the time and the fallback', () => {
    for (const m of [native('xmtp.org/text:1.0', 'hi', 'fb'), web('text', 'hi', 'fb')]) {
      expect(m).toEqual({ id: 'm1', senderInboxId: 'alice', sentNs: NS, sentMs: MS, contentTypeId: 'text', content: 'hi', fallback: 'fb' });
    }
  });

  test('a reaction reads the same on both', () => {
    const nativeVote = native('xmtp.org/reaction:2.0', { reference: 'p1', action: 'removed', content: '0:1', schema: 'custom' });
    const webVote = web('reaction', {
      reference: 'p1',
      referenceInboxId: '',
      action: ReactionAction.Removed,
      content: '0:1',
      schema: ReactionSchema.Custom,
    });
    for (const m of [nativeVote, webVote]) {
      expect(m.content).toEqual({ reference: 'p1', content: '0:1', removed: true, custom: true });
      expect(envelopeOf(m, LINE).payload).toEqual({
        contentType: 'reaction',
        reactTo: 'p1',
        emoji: '0:1',
        schema: 'custom',
        removed: true,
      });
    }
    const added = web('reaction', { reference: 'm0', action: ReactionAction.Added, content: '👍', schema: ReactionSchema.Unicode });
    expect(added.content).toEqual({ reference: 'm0', content: '👍', removed: false, custom: false });
  });

  test('a reply reads the same on both, with its text or its file', () => {
    expect(native('xmtp.org/reply:1.0', { reference: 'r1', content: { text: 'yes' } }).content).toEqual({
      reference: 'r1',
      text: 'yes',
      remote: undefined,
    });
    expect(web('reply', { referenceId: 'r1', content: 'yes' }).content).toEqual({ reference: 'r1', text: 'yes', remote: undefined });
    const nativeFile = native('xmtp.org/reply:1.0', { reference: 'r1', content: { remoteAttachment: remote } });
    const webFile = web('reply', { referenceId: 'r1', content: remote, contentType: () => Promise.reject(new Error('not called')) });
    for (const m of [nativeFile, webFile]) {
      expect(envelopeOf(m, LINE)).toMatchObject({ text: '[file: message.txt]', replyTo: 'r1' });
      expect(rowPreviewOf(m)).toBe('[reply]');
    }
  });

  test('an inline attachment carries base64 data on both', () => {
    const nativeFile = native('xmtp.org/attachment:1.0', { filename: 'n.txt', mimeType: 'text/plain', data: 'AAAAAA==' });
    const webFile = web('attachment', { filename: 'n.txt', mimeType: 'text/plain', content: new Uint8Array(4) });
    for (const m of [nativeFile, webFile]) expect(m.content).toEqual({ filename: 'n.txt', mimeType: 'text/plain', dataB64: 'AAAAAA==' });
  });

  test('a deleted placeholder says who deleted it on both', () => {
    expect(web('deletedMessage', { deletedBy: 0 }).content).toEqual({ deletedBy: 'sender' });
    expect(web('deletedMessage', { deletedBy: 1, adminInboxId: 'x' }).content).toEqual({ deletedBy: 'admin' });
    expect(native('deletedMessage', { deletedBy: 'Admin' }).content).toEqual({ deletedBy: 'admin' });
    expect(native('deletedMessage', { deletedBy: 'Sender' }).content).toEqual({ deletedBy: 'sender' });
  });

  test('a native codec that throws marks the message undecodable', () => {
    const m = nativeMessageOf({
      id: 'm1',
      senderInboxId: 'alice',
      sentNs: NS,
      contentTypeId: 'example.com/somethingNew:9.9',
      content: () => {
        throw new Error('codec not registered');
      },
      fallback: 'fallback text',
    });
    expect(m).toMatchObject({ contentTypeId: 'somethingNew', content: undefined, undecodable: true });
    expect(envelopeOf(m, LINE).text).toBe('[somethingNew payload]');
  });

  test('other content passes through unchanged', () => {
    const frame = { messages: [] };
    expect(native('stage.box/frame:2.0', frame).content).toBe(frame);
    expect(web('frame', frame).content).toBe(frame);
  });
});

describe('native group policy', () => {
  test('reads name, description and image from their own policies', () => {
    expect(
      nativeGroupMetaPolicy({
        updateGroupNamePolicy: 'admin',
        updateGroupDescriptionPolicy: 'deny',
        updateGroupImagePolicy: 'superAdmin',
        updateAppDataPolicy: 'admin',
        addMemberPolicy: 'allow',
        removeMemberPolicy: 'admin',
      }),
    ).toEqual({ name: 'admin', description: 'deny', image: 'superAdmin', appData: 'admin', addMember: 'allow', removeMember: 'admin' });
  });
});

describe('nativeInstallationCreatedAtMs', () => {
  const AT = Date.UTC(2026, 8, 24, 10, 30);
  test('Android hands over nanoseconds labelled as milliseconds', () => {
    expect(nativeInstallationCreatedAtMs(AT * 1_000_000)).toBe(AT);
  });
  test('iOS hands over seconds since the epoch', () => {
    expect(nativeInstallationCreatedAtMs(AT / 1_000)).toBe(AT);
    expect(nativeInstallationCreatedAtMs(AT / 1_000 + 0.25)).toBe(AT + 250);
  });
  test('milliseconds and microseconds pass through as milliseconds', () => {
    expect(nativeInstallationCreatedAtMs(AT)).toBe(AT);
    expect(nativeInstallationCreatedAtMs(AT * 1_000)).toBe(AT);
  });
  test('every result is a valid date', () => {
    for (const value of [AT * 1_000_000, AT * 1_000, AT, AT / 1_000]) {
      expect(Number.isNaN(new Date(nativeInstallationCreatedAtMs(value) ?? Number.NaN).getTime())).toBe(false);
    }
  });
  test('missing or nonsense values are unknown', () => {
    for (const value of [undefined, null, 0, -5, Number.NaN, '1700000000']) expect(nativeInstallationCreatedAtMs(value)).toBeUndefined();
  });
});
