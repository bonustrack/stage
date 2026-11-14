import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '@stage-labs/client/types';
import { canReportMessage, messageReportText, personReportText } from '../components/moderation/report.model';

const ME = 'stage://xmtp/user/me';

function entry(over: Partial<HistoryEntry> = {}): HistoryEntry {
  return {
    id: 'm1',
    ts: '2026-11-14T10:00:00.000Z',
    station: 'xmtp',
    line: 'stage://xmtp/c1',
    to: 'stage://xmtp/c1',
    from: 'stage://xmtp/user/bob',
    text: 'hi',
    ...over,
  };
}

describe('message reports', () => {
  test('quote the message under who sent it, which chat and when', () => {
    const text = messageReportText({
      sender: '0xb0b',
      senderName: '@bob',
      convId: 'c1',
      chatName: 'Builders',
      group: true,
      messageId: 'm1',
      sentAt: '2026-11-14T10:00:00.000Z',
      content: 'line one\nline two',
    });
    expect(text).toBe(
      [
        'Report: message',
        'From: @bob (0xb0b)',
        'Chat: channel Builders (c1)',
        'Message: m1, sent 2026-11-14T10:00:00.000Z',
        '',
        '> line one',
        '> line two',
      ].join('\n'),
    );
  });

  test('a direct message without a known name names the sender once and caps long content', () => {
    const text = messageReportText({
      sender: '0xb0b',
      senderName: null,
      convId: 'c2',
      chatName: null,
      group: false,
      messageId: 'm2',
      sentAt: 't',
      content: 'x'.repeat(2500),
    });
    expect(text).toContain('From: 0xb0b\n');
    expect(text).toContain('Chat: direct message (c2)');
    expect(text.endsWith('…')).toBe(true);
    expect(text.length).toBeLessThan(2200);
  });

  test('a person report names who is reported', () => {
    expect(personReportText({ address: '0xb0b', name: '@bob' })).toBe('Report: person\nWho: @bob (0xb0b)');
  });

  test('only messages from other people can be reported, never your own, pending, system or deleted ones', () => {
    expect(canReportMessage(entry(), ME)).toBe(true);
    expect(canReportMessage(null, ME)).toBe(false);
    expect(canReportMessage(entry({ from: ME }), ME)).toBe(false);
    expect(canReportMessage(entry({ pending: true }), ME)).toBe(false);
    expect(canReportMessage(entry({ payload: { contentType: 'group_updated', system: true } }), ME)).toBe(false);
    expect(canReportMessage(entry({ payload: { contentType: 'deletedMessage', deletedBy: 'sender' } }), ME)).toBe(false);
  });
});
