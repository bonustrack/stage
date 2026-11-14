import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { UNSUPPORTED_MESSAGE_TEXT, chatPreviewOf, walletFreeEntry } from '../lib/walletContent.model';

const paymentRequest: HistoryEntry = {
  id: 'm1',
  from: 'xmtp:alice',
  ts: '2026-11-14T10:00:00.000Z',
  station: 'xmtp',
  line: 'xmtp:conv',
  to: 'xmtp:conv',
  text: '[Transaction request] Dinner',
  payload: { contentType: 'walletSendCalls', walletSendCalls: { version: '1.0', chainId: '0x2105', from: '0x1', calls: [] } },
};

describe('wallet messages in a build without the wallet', () => {
  test('a payment request shows as an unsupported message with no card to pay', () => {
    const shown = walletFreeEntry(paymentRequest, false);
    expect(shown.text).toBe(UNSUPPORTED_MESSAGE_TEXT);
    expect(shown.payload).toEqual({ contentType: 'walletSendCalls' });
    expect(shown.id).toBe(paymentRequest.id);
  });

  test('every other message, and every message when the wallet is on, is left as it is', () => {
    const text: HistoryEntry = { ...paymentRequest, id: 'm2', text: 'hello', payload: { contentType: 'text' } };
    expect(walletFreeEntry(text, false)).toBe(text);
    expect(walletFreeEntry(paymentRequest, true)).toBe(paymentRequest);
  });

  test('chat list previews hide payment and signature content by full or short type id', () => {
    expect(chatPreviewOf({}, 'xmtp.org/walletSendCalls:1.0', false)).toBe(UNSUPPORTED_MESSAGE_TEXT);
    expect(chatPreviewOf({}, 'transactionReference', false)).toBe(UNSUPPORTED_MESSAGE_TEXT);
    expect(chatPreviewOf({}, 'signatureRequest', false)).toBe(UNSUPPORTED_MESSAGE_TEXT);
    expect(chatPreviewOf('hi there', 'xmtp.org/text:1.0', false)).toBe('hi there');
    expect(chatPreviewOf({}, 'signatureRequest', true)).toBe('Signature request');
  });
});
