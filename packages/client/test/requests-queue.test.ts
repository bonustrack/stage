
import { describe, expect, test } from 'bun:test';
import {
  buildRequestsQueue, type FeedRequestInput, type MessageRequestInput,
} from '../src/xmtp/requests-queue';
import type { HistoryEntry } from '../src/types';
import type { ConversationRequestView } from '../src/xmtp/request';

const ME = 'metro://user/me';
const OTHER = 'metro://user/other';

function entry(part: Partial<HistoryEntry> & { id: string; payload?: unknown }): HistoryEntry {
  return {
    id: part.id,
    ts: part.ts ?? '2026-01-01T00:00:00.000Z',
    station: 'xmtp',
    line: 'l',
    from: part.from ?? OTHER,
    to: 'l',
    payload: part.payload,
    text: part.text,
  };
}

function pollEntry(id: string, ts: string, opts: string[] = ['a', 'b']): HistoryEntry {
  return entry({
    id, ts,
    payload: {
      contentType: 'poll',
      poll: { pollId: id, questions: [{ question: 'Q', options: opts.map(label => ({ label })) }] },
    },
  });
}

function voteEntry(reactTo: string, optionIndex: number, from: string): HistoryEntry {
  return entry({
    id: `vote-${reactTo}-${optionIndex}-${from}`,
    payload: { schema: 'custom', reactTo, emoji: `0:${optionIndex}` },
    from,
  });
}

function txEntry(id: string, ts: string): HistoryEntry {
  return entry({
    id, ts,
    payload: { contentType: 'walletSendCalls', walletSendCalls: { version: '1.0', chainId: '0x1', from: '0x0', calls: [{ to: '0x1' }] } },
  });
}

function sigEntry(id: string, ts: string): HistoryEntry {
  return entry({
    id, ts,
    payload: { contentType: 'signatureRequest', signatureRequest: { id, kind: 'personal', message: 'sign me' } },
  });
}

function msgInput(convId: string, ts: number): MessageRequestInput {
  const view: ConversationRequestView = {
    convId, title: 't', peerAddress: null, avatarAddress: null,
    avatarUri: null, preview: 'p', isGroup: false,
  };
  return { view, ts };
}

describe('buildRequestsQueue', () => {
  test('maps content types to the four request kinds', () => {
    const feeds: FeedRequestInput[] = [
      { convId: 'c-poll', events: [pollEntry('p1', '2026-01-01T00:00:01.000Z')] },
      { convId: 'c-pay', events: [txEntry('t1', '2026-01-01T00:00:02.000Z')] },
      { convId: 'c-sig', events: [sigEntry('s1', '2026-01-01T00:00:03.000Z')] },
    ];
    const out = buildRequestsQueue({ feeds, messageRequests: [msgInput('c-msg', Date.parse('2026-01-01T00:00:04.000Z'))], myUri: ME });
    const byConv = Object.fromEntries(out.map(r => [r.convId, r.kind]));
    expect(byConv).toEqual({
      'c-poll': 'poll', 'c-pay': 'payment', 'c-sig': 'signing', 'c-msg': 'message',
    });
  });

  test('drops a poll once the current account has voted on every question', () => {
    const poll = pollEntry('p1', '2026-01-01T00:00:01.000Z');
    const feeds: FeedRequestInput[] = [
      { convId: 'c-voted', events: [poll, voteEntry('p1', 0, ME)] },
    ];
    const out = buildRequestsQueue({ feeds, messageRequests: [], myUri: ME });
    expect(out).toHaveLength(0);
  });

  test('keeps a poll when only another member has voted', () => {
    const poll = pollEntry('p1', '2026-01-01T00:00:01.000Z');
    const feeds: FeedRequestInput[] = [
      { convId: 'c-open', events: [poll, voteEntry('p1', 0, OTHER)] },
    ];
    const out = buildRequestsQueue({ feeds, messageRequests: [], myUri: ME });
    expect(out).toHaveLength(1);
    expect(out[0]?.kind).toBe('poll');
  });

  test('only considers the latest event of each feed', () => {
    const feeds: FeedRequestInput[] = [
      { convId: 'c', events: [entry({ id: 'plain', text: 'hi', ts: '2026-01-01T00:00:05.000Z' }), txEntry('t1', '2026-01-01T00:00:02.000Z')] },
    ];
    const out = buildRequestsQueue({ feeds, messageRequests: [], myUri: ME });
    expect(out).toHaveLength(0);
  });

  test('sorts the unified queue newest-first', () => {
    const feeds: FeedRequestInput[] = [
      { convId: 'c-pay', events: [txEntry('t1', '2026-01-01T00:00:02.000Z')] },
      { convId: 'c-sig', events: [sigEntry('s1', '2026-01-01T00:00:09.000Z')] },
    ];
    const out = buildRequestsQueue({
      feeds,
      messageRequests: [msgInput('c-msg', Date.parse('2026-01-01T00:00:05.000Z'))],
      myUri: ME,
    });
    expect(out.map(r => r.convId)).toEqual(['c-sig', 'c-msg', 'c-pay']);
  });

  test('returns an empty queue when nothing is pending', () => {
    expect(buildRequestsQueue({ feeds: [], messageRequests: [], myUri: ME })).toEqual([]);
  });
});
