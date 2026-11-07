import { describe, expect, test } from 'bun:test';
import {
  attachmentsOf,
  attachmentsPayload,
  isAttachmentSummary,
  messageKindOf,
  pollContentOf,
  reactionOf,
  signatureRequestOf,
  structuredPayload,
  walletSendCallsOf,
} from '../src/xmtp/entryPayload';
import { envelopeOf } from '../src/xmtp/envelope';
import { xmtpMessage } from './fixtures/decoded-messages';
import type { PollContent } from '../src/xmtp/poll';
import { entry, storedEntry } from './helpers';

const LINE = 'stage://xmtp/c';
const at = (contentTypeId: string, content: unknown) => envelopeOf(xmtpMessage({ contentTypeId, content }), LINE);

describe('entry payload', () => {
  test('one kind per entry, in the order the bubble decides', () => {
    const poll = { question: 'Lunch?', options: [{ label: 'Yes' }, { label: 'No' }] };
    const wsc = { version: '1.0', chainId: '0x2105', from: '0x1', calls: [{ to: '0x2', value: '0x0' }] };
    expect(messageKindOf(at('text', 'hi'))).toBe('text');
    expect(messageKindOf(at('poll', poll))).toBe('poll');
    expect(messageKindOf(at('walletSendCalls', wsc))).toBe('txRequest');
    expect(messageKindOf(at('group_updated', { addedInboxes: [] }))).toBe('system');
    expect(messageKindOf(at('leave_request', {}))).toBe('system');
    expect(messageKindOf(at('reaction', { reference: 'm1', content: '👍', removed: false, custom: false }))).toBe('reaction');
    expect(messageKindOf(at('multiRemoteStaticAttachment', { attachments: [{ url: 'u' }] }))).toBe('attachments');
    expect(messageKindOf(at('deleteRequest', { messageId: 'm1' }))).toBe('hidden');
    expect(messageKindOf(at('deletedMessage', { deletedBy: 'admin' }))).toBe('deleted');
    expect(messageKindOf(at('frameAction', { frameId: 'f1', action: { name: 'go' } }))).toBe('frameAction');
    expect(messageKindOf(storedEntry('legacy', { payload: { reactTo: 'm1', emoji: '+1' } }))).toBe('reaction');
    expect(messageKindOf(entry('bare'))).toBe('text');
  });

  test('the composer builds the same structured payload as an arriving message', () => {
    const poll: PollContent = { pollId: 'p1', question: 'Lunch?', options: [{ label: 'Yes' }, { label: 'No' }] };
    expect(at('poll', poll).payload).toEqual(structuredPayload('poll', poll));
    const receipt = { networkId: 8453, reference: '0xabc' };
    expect(structuredPayload('transactionReference', receipt)).toEqual({ contentType: 'transactionReference', txReference: receipt });
    expect(attachmentsPayload([{ kind: 'image', mime: 'image/png' }])).toEqual({ attachments: [{ kind: 'image', mime: 'image/png' }] });
  });

  test('accessors validate what they read, so an old snapshot cannot break a reader', () => {
    expect(pollContentOf(storedEntry('p', { payload: { contentType: 'poll', poll: 'nope' } }))).toBeUndefined();
    expect(
      signatureRequestOf(storedEntry('s', { payload: { contentType: 'signatureRequest', signatureRequest: { message: 'x' } } })),
    ).toBeUndefined();
    expect(
      walletSendCallsOf(storedEntry('w', { payload: { contentType: 'walletSendCalls', walletSendCalls: { calls: 'x' } } })),
    ).toBeUndefined();
    expect(attachmentsOf(storedEntry('a', { payload: { contentType: 'reply', attachments: 'x' } }))).toEqual([]);
    expect(reactionOf(storedEntry('r', { payload: { reactTo: 'm1', emoji: 7 } }))).toBeNull();
    expect(reactionOf(storedEntry('r', { payload: { reactTo: 'm1', emoji: '1', schema: 'custom', removed: 1 } }))).toEqual({
      reactTo: 'm1',
      emoji: '1',
      removed: true,
      custom: true,
    });
  });

  test('the attachment summary text is recognised from the attachments it names', () => {
    expect(isAttachmentSummary(at('multiRemoteStaticAttachment', { attachments: [{ url: 'u', filename: '54eb37a9.avif' }] }))).toBe(true);
    expect(isAttachmentSummary(at('attachment', { filename: 'photo.png', mimeType: 'image/png', dataB64: 'AA==' }))).toBe(true);
    expect(isAttachmentSummary(at('attachment', { mimeType: 'image/png', dataB64: 'AA==' }))).toBe(true);
    expect(isAttachmentSummary(at('multiRemoteAttachment', { attachments: [{ url: 'a' }, { url: 'b' }, { url: 'c' }] }))).toBe(true);
    const caption = { text: 'look at this [file: a.pdf]', payload: { attachments: [{ kind: 'file', name: 'a.pdf' }] } };
    expect(isAttachmentSummary(caption)).toBe(false);
    expect(isAttachmentSummary({ text: '[file: a.pdf]', payload: { attachments: [] } })).toBe(false);
  });
});
