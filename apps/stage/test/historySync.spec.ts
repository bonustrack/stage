import { describe, expect, test } from 'bun:test';
import {
  formatHistoryPin, historyPinFromRandom, historyProblemMessage, historySyncIsActive, historySyncPhaseLabel,
  isMissingArchive, isValidHistoryPin, normalizeHistoryPin, settleBy, timeLeftLabel, within,
  HISTORY_COPY, HistoryProblem,
} from '../lib/historySync.model';

describe('history pin', () => {
  test('derives six digits from random bytes', () => {
    expect(historyPinFromRandom(new Uint8Array([10, 21, 32, 43, 54, 65, 76]))).toBe('012345');
  });

  test('pads a short byte source', () => {
    expect(historyPinFromRandom(new Uint8Array([9, 9]))).toBe('990000');
  });

  test('normalizes and validates typed pins', () => {
    expect(normalizeHistoryPin(' 483 920 ')).toBe('483920');
    expect(isValidHistoryPin('483920')).toBe(true);
    expect(isValidHistoryPin('48392')).toBe(false);
    expect(isValidHistoryPin('48392a')).toBe(false);
  });

  test('formats a pin in two groups', () => {
    expect(formatHistoryPin('483920')).toBe('483 920');
  });
});

describe('history sync phases', () => {
  test('idle has no label and only the two pending phases are active', () => {
    expect(historySyncPhaseLabel('idle')).toBeNull();
    expect(historySyncPhaseLabel('waiting')).toContain('other device');
    expect(historySyncPhaseLabel('error')).toBe(HISTORY_COPY.failed);
    expect(historySyncPhaseLabel('error', HISTORY_COPY.olderVersion)).toBe(HISTORY_COPY.olderVersion);
    expect(historySyncIsActive('requesting')).toBe(true);
    expect(historySyncIsActive('waiting')).toBe(true);
    expect(historySyncIsActive('done')).toBe(false);
  });
});

describe('historyProblemMessage', () => {
  test('explains a PIN with no archive yet', () => {
    const err = new Error('Could not find payload with pin Some("123456")');
    expect(isMissingArchive(err)).toBe(true);
    expect(historyProblemMessage(err, 'fallback')).toBe(HISTORY_COPY.pinMissing);
  });

  test('blames an older version when the archive sits on the retired XMTP server', () => {
    const err = new Error('reqwest error: HTTP status client error (400 Bad Request) for url (https://message-history.production.ephemera.network/files/abc)');
    expect(isMissingArchive(err)).toBe(false);
    expect(historyProblemMessage(err, 'fallback')).toBe(HISTORY_COPY.olderVersion);
  });

  test('reports an expired archive and an unreachable server', () => {
    expect(historyProblemMessage(new Error('HTTP status client error (404 Not Found) for url (x)'), 'fallback')).toBe(HISTORY_COPY.expired);
    expect(historyProblemMessage(new Error('reqwest error: error sending request'), 'fallback')).toBe(HISTORY_COPY.network);
  });

  test('keeps our own problems and falls back for anything else', () => {
    expect(historyProblemMessage(new HistoryProblem(HISTORY_COPY.sendSlow), 'fallback')).toBe(HISTORY_COPY.sendSlow);
    expect(historyProblemMessage(new Error('boom'), 'fallback')).toBe('fallback');
  });
});

describe('within', () => {
  test('rejects with the given message when a step never answers', async () => {
    const hung = new Promise<string>(() => undefined);
    const outcome = await within(hung, 20, HISTORY_COPY.importSlow).catch((e: unknown) => e);
    expect(outcome).toBeInstanceOf(HistoryProblem);
    expect(historyProblemMessage(outcome, 'fallback')).toBe(HISTORY_COPY.importSlow);
  });

  test('passes a result or a failure through untouched', async () => {
    expect(await within(Promise.resolve(7), 1_000, 'slow')).toBe(7);
    const failure = await within(Promise.reject(new Error('nope')), 1_000, 'slow').catch((e: unknown) => e);
    expect(failure).toBeInstanceOf(Error);
    expect(failure).not.toBeInstanceOf(HistoryProblem);
  });
});

describe('settleBy', () => {
  test('a step that never answers settles with the fallback at the deadline', async () => {
    const hung = new Promise<string>(() => undefined);
    expect(await settleBy(hung, Date.now() + 20, 'timeout')).toBe('timeout');
  });

  test('a step that answers in time keeps its result', async () => {
    expect(await settleBy(Promise.resolve('done'), Date.now() + 1_000, 'timeout')).toBe('done');
  });

  test('a past deadline settles right away', async () => {
    const hung = new Promise<string>(() => undefined);
    expect(await settleBy(hung, Date.now() - 1, 'timeout')).toBe('timeout');
  });
});

describe('timeLeftLabel', () => {
  test('shows minutes and seconds, rounding up and never going negative', () => {
    expect(timeLeftLabel(120_000)).toBe('2:00 left');
    expect(timeLeftLabel(83_200)).toBe('1:24 left');
    expect(timeLeftLabel(900)).toBe('0:01 left');
    expect(timeLeftLabel(-5_000)).toBe('0:00 left');
  });
});
