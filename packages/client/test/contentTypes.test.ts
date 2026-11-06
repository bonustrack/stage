import { describe, expect, test } from 'bun:test';
import {
  attachedFilesOf,
  previewOfXmtpContent,
  roleOfType,
  rowPreviewOf,
  STAGE_JSON_CODECS,
  stageCodecsFor,
} from '../src/xmtp/contentTypes';

const idOf = (codec: { contentType: { authorityId: string; typeId: string } }): string =>
  `${codec.contentType.authorityId}/${codec.contentType.typeId}`;

describe('content type table', () => {
  test('each SDK gets the Stage codecs plus the one it lacks built in', () => {
    const shared = STAGE_JSON_CODECS.map(idOf);
    expect(stageCodecsFor('native').map(idOf)).toEqual([...shared, 'xmtp.org/transactionReference']);
    expect(stageCodecsFor('web').map(idOf)).toEqual([...shared, 'xmtp.org/deleteMessage']);
  });

  test('every type has one role, and unknown types are bubbles', () => {
    expect(
      ['text', 'group_updated', 'leave_request', 'reaction', 'readReceipt', 'callSignal', 'deleteRequest', 'readState'].map(roleOfType),
    ).toEqual(['bubble', 'system', 'system', 'silent', 'silent', 'hidden', 'hidden', 'hidden']);
    expect(roleOfType('stage.box/callSignal:1.0')).toBe('hidden');
    expect(roleOfType('somethingNew')).toBe('bubble');
    expect(roleOfType(undefined)).toBe('bubble');
  });

  test('an unknown type previews as its id, and a preview that throws as the message type', () => {
    expect(previewOfXmtpContent({ a: 1 }, 'somethingNew')).toBe('[somethingNew]');
    expect(previewOfXmtpContent({ a: 1 }, undefined)).toBe('[unknown]');
    expect(rowPreviewOf({ contentTypeId: 'poll', content: null })).toBe('[poll]');
  });

  test('attached files come from inline, remote, multi remote and file replies', () => {
    const remote = { url: 'https://x', contentDigest: 'd', secret: 's', salt: 's', nonce: 'n', filename: 'a.pdf', contentLength: 9 };
    expect(attachedFilesOf('attachment', { filename: 'n.txt', mimeType: 'text/plain', dataB64: 'AAAA' })).toEqual([
      { name: 'n.txt', size: 3, mime: 'text/plain', dataB64: 'AAAA' },
    ]);
    expect(attachedFilesOf('remoteStaticAttachment', remote)).toEqual([{ name: 'a.pdf', size: 9, remote }]);
    expect(attachedFilesOf('multiRemoteAttachment', { attachments: [remote, {}] })).toEqual([
      { name: 'a.pdf', size: 9, remote },
      { name: undefined, size: undefined, remote: {} },
    ]);
    expect(attachedFilesOf('reply', { reference: 'r', remote })).toEqual([{ name: 'a.pdf', size: 9, remote }]);
    expect(attachedFilesOf('reply', { reference: 'r', text: 'hi' })).toEqual([]);
    expect(attachedFilesOf('text', 'hi')).toEqual([]);
  });
});
