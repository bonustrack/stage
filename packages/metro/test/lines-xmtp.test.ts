/**
 * `src/lines.ts` — XMTP account-scoped line splitting + build→parse round-trips.
 * Companion to lines.test.ts (builders/parsers); split out for the 200-line cap.
 */

import { describe, expect, test } from 'bun:test';
import { Line } from '../src/lines.ts';

describe('xmtp account-scoped lines (per-CLI feed isolation)', () => {
  /**
   * The per-CLI feed-isolation fix moved XMTP lines to the account-scoped
   * `metro://xmtp/<account>/<conv>` form (legacy single-segment
   * `metro://xmtp/<conv>` maps to the `default` account). There is no
   * `Line.xmtp` builder — the xmtp train owns construction — so these assert
   * that the generic `Line.parse` splits the account/conv segments the way
   * cli/send-guard.ts#targetAccount() depends on.
   */
  test('account-scoped form splits into [account, conv]', () => {
    expect(Line.parse('metro://xmtp/tony/0xconv')).toEqual({ station: 'xmtp', path: ['tony', '0xconv'] });
    expect(Line.parse('metro://xmtp/codex/0xabc')).toEqual({ station: 'xmtp', path: ['codex', '0xabc'] });
  });
  test('account is the first path segment', () => {
    const p = Line.parse('metro://xmtp/tony/0xconv');
    expect(p?.path[0]).toBe('tony');
  });
  test('legacy single-segment form parses to a single conv path (→ default account)', () => {
    /** send-guard treats a one-segment xmtp path as the `default` account. */
    expect(Line.parse('metro://xmtp/0xconv')).toEqual({ station: 'xmtp', path: ['0xconv'] });
  });
  test('station is xmtp for both forms', () => {
    expect(Line.station('metro://xmtp/tony/0xconv')).toBe('xmtp');
    expect(Line.station('metro://xmtp/0xconv')).toBe('xmtp');
  });
  test('xmtp is not a local station', () => {
    expect(Line.isLocal('metro://xmtp/tony/0xconv')).toBe(false);
  });
  test('conv ids containing extra segments preserve all path parts', () => {
    expect(Line.parse('metro://xmtp/tony/group/0xdef')).toEqual({ station: 'xmtp', path: ['tony', 'group', '0xdef'] });
  });
});

describe('round-trips: build → parse', () => {
  test('discord round-trips', () => {
    const l = Line.discord('chan-1');
    expect(Line.parse(l)).toEqual({ station: 'discord', path: ['chan-1'] });
    expect(Line.station(l)).toBe('discord');
  });

  test('telegram chat+topic round-trips through parseTelegram', () => {
    const l = Line.telegram(-555, 7);
    expect(Line.parseTelegram(l)).toEqual({ chatId: -555, topicId: 7 });
  });

  test('claude full-session round-trips through parseClaude', () => {
    const l = Line.claude('org-x', 'sess-y');
    expect(Line.parseClaude(l)).toEqual({ userId: 'org-x', sessionId: 'sess-y' });
    expect(Line.isLocal(l)).toBe(true);
  });

  test('webhook round-trips through parseWebhook', () => {
    const l = Line.webhook('ep-1');
    expect(Line.parseWebhook(l)).toBe('ep-1');
  });
});
