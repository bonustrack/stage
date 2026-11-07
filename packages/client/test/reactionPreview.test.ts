import { describe, expect, test } from 'bun:test';
import { buildOpenAnswer, buildReaction, buildVote } from '../src/xmtp/builders';
import { openVoteKey } from '../src/xmtp/poll-tally';
import { previewOf } from './helpers';

const REACTION = 'xmtp.org/reaction:2.0';

describe('previewOfXmtpContent for reactions', () => {
  test('shows the emoji of a normal reaction', () => {
    expect(previewOf(buildReaction('m1', '🔥'), REACTION)).toBe('🔥');
    expect(previewOf({}, REACTION)).toBe('👍');
  });

  test('shows a poll vote as a vote, not as its option key', () => {
    expect(previewOf(buildVote('p1', 0), REACTION)).toBe('Voted in a poll');
    expect(previewOf(buildVote('p1', 3, 'added', 2), REACTION)).toBe('Voted in a poll');
    expect(previewOf(buildVote('p1', 1, 'removed'), 'reaction')).toBe('Voted in a poll');
  });

  test('reads the web SDK shape, where schema and action are numbers', () => {
    expect(previewOf({ reference: 'p1', referenceInboxId: '', action: 1, content: '0', schema: 3 }, REACTION)).toBe('Voted in a poll');
  });

  test('shows a free-text poll answer as an answer', () => {
    expect(previewOf(buildOpenAnswer('p1', openVoteKey(0, 'Friday works')), REACTION)).toBe('Answered a poll');
  });
});
