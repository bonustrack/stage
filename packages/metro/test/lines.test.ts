/**
 * Unit tests for `src/lines.ts` — the `metro://` URI vocabulary.
 *
 * Covers builders (discord/telegram/claude/codex/webhook/user), the generic
 * `parse`/`station` split, the local-session parsers (`parseClaude`/`parseCodex`
 * — participant `/user/<id>` URIs vs full `<userId>/<sessionId>` sessions),
 * `parseTelegram`, `parseWebhook`, `isLocal`, round-trips, and malformed input.
 *
 * Pure in-process; no fs / network.
 */

import { describe, expect, test } from 'bun:test';
import { Line, asLine } from '../src/lines.ts';

describe('Line builders', () => {
  test('discord', () => {
    expect(Line.discord('456')).toBe(asLine('metro://discord/456'));
  });

  test('telegram without topic', () => {
    expect(Line.telegram(123)).toBe(asLine('metro://telegram/123'));
    expect(Line.telegram('-100')).toBe(asLine('metro://telegram/-100'));
  });

  test('telegram with topic', () => {
    expect(Line.telegram(-100, 42)).toBe(asLine('metro://telegram/-100/42'));
    /** topicId === 0 is a real value, must NOT be dropped as undefined. */
    expect(Line.telegram(-100, 0)).toBe(asLine('metro://telegram/-100/0'));
  });

  test('claude / codex full-session builders', () => {
    expect(Line.claude('org1', 'sess1')).toBe(asLine('metro://claude/org1/sess1'));
    expect(Line.codex('acct1', 'thread1')).toBe(asLine('metro://codex/acct1/thread1'));
  });

  test('webhook', () => {
    expect(Line.webhook('gh-main')).toBe(asLine('metro://webhook/gh-main'));
  });

  test('user participant builder', () => {
    expect(Line.user('discord', 'alice')).toBe(asLine('metro://discord/user/alice'));
    expect(Line.user('telegram', 99)).toBe(asLine('metro://telegram/user/99'));
  });
});

describe('Line.parse — generic station/path split', () => {
  test('single-segment path', () => {
    expect(Line.parse('metro://discord/456')).toEqual({ station: 'discord', path: ['456'] });
  });

  test('multi-segment path', () => {
    expect(Line.parse('metro://telegram/-100/42')).toEqual({ station: 'telegram', path: ['-100', '42'] });
  });

  test('collapses empty segments from doubled / and trailing slash', () => {
    expect(Line.parse('metro://discord//456/')).toEqual({ station: 'discord', path: ['456'] });
  });

  test('rejects non-metro prefix', () => {
    expect(Line.parse('https://discord/456')).toBeNull();
    expect(Line.parse('discord/456')).toBeNull();
  });

  test('rejects missing station (no slash after prefix)', () => {
    expect(Line.parse('metro://discord')).toBeNull();
  });

  test('rejects empty station (leading slash)', () => {
    expect(Line.parse('metro:///456')).toBeNull();
  });

  test('rejects station with empty path (only slashes)', () => {
    expect(Line.parse('metro://discord//')).toBeNull();
  });
});

describe('Line.station', () => {
  test('returns station for valid line', () => {
    expect(Line.station('metro://discord/456')).toBe('discord');
  });
  test('returns null for malformed line', () => {
    expect(Line.station('not-a-line')).toBeNull();
  });
});

describe('parseClaude / parseCodex — participant vs full-session URIs', () => {
  test('full session URI parses to {userId, sessionId}', () => {
    expect(Line.parseClaude('metro://claude/org1/sess1')).toEqual({ userId: 'org1', sessionId: 'sess1' });
    expect(Line.parseCodex('metro://codex/acct1/thread1')).toEqual({ userId: 'acct1', sessionId: 'thread1' });
  });

  test('participant URI (/user/<id>) is skipped — returns null', () => {
    expect(Line.parseClaude('metro://claude/user/abc')).toBeNull();
    expect(Line.parseCodex('metro://codex/user/xyz')).toBeNull();
  });

  test('single-segment (userId only, no session) returns null', () => {
    expect(Line.parseClaude('metro://claude/org1')).toBeNull();
    expect(Line.parseCodex('metro://codex/acct1')).toBeNull();
  });

  test('wrong station returns null (claude parser rejects codex and vice versa)', () => {
    expect(Line.parseClaude('metro://codex/acct1/thread1')).toBeNull();
    expect(Line.parseCodex('metro://claude/org1/sess1')).toBeNull();
  });

  test('malformed input returns null', () => {
    expect(Line.parseClaude('garbage')).toBeNull();
    expect(Line.parseCodex('metro://')).toBeNull();
  });

  test('extra trailing segments still parse to first two', () => {
    /** path[0]=userId, path[1]=sessionId; anything after is ignored. */
    expect(Line.parseClaude('metro://claude/org1/sess1/extra')).toEqual({ userId: 'org1', sessionId: 'sess1' });
  });
});

describe('parseTelegram', () => {
  test('chatId only', () => {
    expect(Line.parseTelegram(asLine('metro://telegram/123'))).toEqual({ chatId: 123 });
  });
  test('negative chatId', () => {
    expect(Line.parseTelegram(asLine('metro://telegram/-1003950444088'))).toEqual({ chatId: -1003950444088 });
  });
  test('chatId + topicId', () => {
    expect(Line.parseTelegram(asLine('metro://telegram/-100/42'))).toEqual({ chatId: -100, topicId: 42 });
  });
  test('non-numeric chatId returns null', () => {
    expect(Line.parseTelegram(asLine('metro://telegram/abc'))).toBeNull();
  });
  test('non-numeric topicId falls back to null (whole parse fails)', () => {
    expect(Line.parseTelegram(asLine('metro://telegram/100/notanum'))).toBeNull();
  });
  test('wrong station returns null', () => {
    expect(Line.parseTelegram(asLine('metro://discord/123'))).toBeNull();
  });
});

describe('parseWebhook', () => {
  test('single-segment endpoint parses', () => {
    expect(Line.parseWebhook('metro://webhook/gh-main')).toBe('gh-main');
  });
  test('multi-segment webhook returns null (must be exactly one segment)', () => {
    expect(Line.parseWebhook('metro://webhook/gh/main')).toBeNull();
  });
  test('wrong station returns null', () => {
    expect(Line.parseWebhook('metro://discord/gh-main')).toBeNull();
  });
});

describe('isLocal', () => {
  test('claude + codex are local', () => {
    expect(Line.isLocal('metro://claude/org1/sess1')).toBe(true);
    expect(Line.isLocal('metro://codex/acct1/thread1')).toBe(true);
  });
  test('discord/telegram/webhook are not local', () => {
    expect(Line.isLocal('metro://discord/456')).toBe(false);
    expect(Line.isLocal('metro://telegram/123')).toBe(false);
    expect(Line.isLocal('metro://webhook/gh-main')).toBe(false);
  });
  test('malformed line is not local', () => {
    expect(Line.isLocal('garbage')).toBe(false);
  });
});

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
