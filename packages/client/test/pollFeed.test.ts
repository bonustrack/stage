
import { describe, expect, test } from 'bun:test';
import type { HistoryEntry } from '../src/types';
import {
  voteEventsOf, pollQuestionsInFeed, pollOptionCountsInFeed,
  votesByMessage, ownVotesByMessage, openAnswersByMessage,
} from '../src/xmtp/poll-feed';
import { voteKey, openVoteKey } from '../src/xmtp/poll';

const LINE = 'metro://xmtp/tony/conv1';
let seq = 0;
function ts(): string { return new Date(2026, 0, 1, 0, 0, ++seq).toISOString(); }

function pollEntry(id: string, question: string, options: string[], extra?: { multiSelect?: boolean; open?: boolean }): HistoryEntry {
  return {
    id, ts: ts(), station: 'xmtp', line: LINE, from: 'metro:user/alice', to: LINE,
    text: `Poll: ${question}`,
    payload: {
      contentType: 'poll',
      poll: {
        pollId: id, question, options: options.map(label => ({ label })),
        ...(extra?.multiSelect ? { multiSelect: true } : {}),
        ...(extra?.open ? { questions: [{ question, options: options.map(label => ({ label })), open: true }] } : {}),
      },
    },
  };
}

function voteEntry(from: string, pollId: string, content: string, removed = false): HistoryEntry {
  return {
    id: `v-${from}-${content}-${++seq}`, ts: ts(), station: 'xmtp', line: LINE,
    from, to: LINE, text: `[vote ${content}]`,
    payload: { contentType: 'reaction', reactTo: pollId, emoji: content, schema: 'custom', removed },
  };
}

describe('poll-feed shared tally helpers', () => {
  test('pollQuestionsInFeed + pollOptionCountsInFeed extract polls keyed by message id', () => {
    const feed = [pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi', 'Tacos'])];
    const qs = pollQuestionsInFeed(feed);
    expect(qs.get('p1')?.[0]?.options.length).toBe(3);
    expect(pollOptionCountsInFeed(feed).get('p1')).toBe(3);
  });

  test('voteEventsOf only picks custom-schema reactions', () => {
    const feed = [
      voteEntry('metro:user/a', 'p1', voteKey(0, 0)),
      { id: 'r1', ts: ts(), station: 'xmtp', line: LINE, from: 'metro:user/b', to: LINE,
        text: '[react 👍]', payload: { contentType: 'reaction', reactTo: 'p1', emoji: '👍' } } as HistoryEntry,
    ];
    expect(voteEventsOf(feed)).toHaveLength(1);
  });

  test('single-select tally counts distinct voters per option', () => {
    const feed = [
      pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi', 'Tacos']),
      voteEntry('metro:user/a', 'p1', voteKey(0, 0)),
      voteEntry('metro:user/b', 'p1', voteKey(0, 0)),
      voteEntry('metro:user/c', 'p1', voteKey(0, 1)),
    ];
    const tally = votesByMessage(feed).get('p1')?.get(0);
    expect(tally?.get(0)?.size).toBe(2);
    expect(tally?.get(1)?.size).toBe(1);
  });

  test('single-select: latest vote replaces earlier one for same voter', () => {
    const feed = [
      pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi']),
      voteEntry('metro:user/a', 'p1', voteKey(0, 0)),
      voteEntry('metro:user/a', 'p1', voteKey(0, 1)),
    ];
    const tally = votesByMessage(feed).get('p1')?.get(0);
    expect(tally?.get(0)?.size ?? 0).toBe(0);
    expect(tally?.get(1)?.size).toBe(1);
  });

  test('removed vote is not counted', () => {
    const feed = [
      pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi']),
      voteEntry('metro:user/a', 'p1', voteKey(0, 0)),
      voteEntry('metro:user/a', 'p1', voteKey(0, 0), true),
    ];
    expect(votesByMessage(feed).get('p1')?.get(0)?.get(0)?.size ?? 0).toBe(0);
  });

  test('multi-select tally lets one voter pick several options', () => {
    const feed = [
      pollEntry('p1', 'Pick toppings', ['Cheese', 'Olives', 'Ham'], { multiSelect: true }),
      voteEntry('metro:user/a', 'p1', voteKey(0, 0)),
      voteEntry('metro:user/a', 'p1', voteKey(0, 2)),
    ];
    const tally = votesByMessage(feed).get('p1')?.get(0);
    expect(tally?.get(0)?.size).toBe(1);
    expect(tally?.get(2)?.size).toBe(1);
  });

  test('ownVotesByMessage reflects only my selections', () => {
    const feed = [
      pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi']),
      voteEntry('metro:user/me', 'p1', voteKey(0, 1)),
      voteEntry('metro:user/other', 'p1', voteKey(0, 0)),
    ];
    const own = ownVotesByMessage(feed, 'metro:user/me').get('p1')?.get(0);
    expect(own?.has(1)).toBe(true);
    expect(own?.has(0)).toBe(false);
  });

  test('web-shaped vote (SDK string schema/action) is counted', () => {
    const sdkReaction = { reference: 'p1', referenceInboxId: 'inbox-me', action: 'added', content: voteKey(0, 0), schema: 'custom' };
    const isCustom = sdkReaction.schema === 'custom';
    const removed = sdkReaction.action === 'removed';
    const mapped: HistoryEntry = {
      id: `v-web-${++seq}`, ts: ts(), station: 'xmtp', line: LINE, from: 'metro:user/me', to: LINE,
      text: `[vote ${sdkReaction.content}]`,
      payload: {
        contentType: 'reaction', reactTo: sdkReaction.reference, emoji: sdkReaction.content,
        ...(isCustom ? { schema: 'custom' } : {}), removed,
      },
    };
    expect(isCustom).toBe(true);
    const feed = [pollEntry('p1', 'Lunch?', ['Pizza', 'Sushi']), mapped];
    expect(voteEventsOf(feed)).toHaveLength(1);
    expect(votesByMessage(feed).get('p1')?.get(0)?.get(0)?.size).toBe(1);
    expect(ownVotesByMessage(feed, 'metro:user/me').get('p1')?.get(0)?.has(0)).toBe(true);
  });

  test('open answers are decoded from open-vote custom reactions', () => {
    const feed = [
      pollEntry('p1', 'Favorite?', ['A', 'B'], { open: true }),
      voteEntry('metro:user/a', 'p1', openVoteKey(0, 'Mango')),
    ];
    const answers = openAnswersByMessage(feed).get('p1')?.get(0);
    expect(answers?.get('metro:user/a')?.text).toBe('Mango');
  });
});
