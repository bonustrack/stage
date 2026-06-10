/**
 * `src/lines.ts` — canonical account-scoped parsers `Line.parseXmtp` /
 * `Line.parseDiscord`. These are the single source of truth the
 * per-station `parseLine()` helpers (stations/xmtp/accounts.ts,
 * stations/discord/accounts.ts) and cli/send-guard.ts now delegate to, so the
 * cases here pin the exact behavior the old anchored regexes had.
 */

import { describe, expect, test } from 'bun:test';
import { Line } from '../src/lines.ts';

describe('Line.parseXmtp', () => {
  test('new account-scoped form → {accountId, resource}', () => {
    expect(Line.parseXmtp('metro://xmtp/tony/0xconv')).toEqual({ accountId: 'tony', resource: '0xconv' });
    expect(Line.parseXmtp('metro://xmtp/codex/0xabc')).toEqual({ accountId: 'codex', resource: '0xabc' });
  });

  test('legacy single-segment form → default account', () => {
    expect(Line.parseXmtp('metro://xmtp/0xconv')).toEqual({ accountId: 'default', resource: '0xconv' });
  });

  test('three or more segments → null (matches old anchored regex)', () => {
    expect(Line.parseXmtp('metro://xmtp/tony/group/0xdef')).toBeNull();
  });

  test('wrong station → null', () => {
    expect(Line.parseXmtp('metro://discord/123')).toBeNull();
  });

  test('malformed input → null', () => {
    expect(Line.parseXmtp('garbage')).toBeNull();
    expect(Line.parseXmtp('metro://xmtp')).toBeNull();
  });

  test('round-trips with the train builder (new + legacy)', () => {
    expect(Line.parseXmtp('metro://xmtp/tony/0xc')).toEqual({ accountId: 'tony', resource: '0xc' });
    expect(Line.parseXmtp('metro://xmtp/0xc')).toEqual({ accountId: 'default', resource: '0xc' });
  });
});

describe('Line.parseDiscord', () => {
  test('new account-scoped form (snowflake channel) → {accountId, resource}', () => {
    expect(Line.parseDiscord('metro://discord/main/123456')).toEqual({ accountId: 'main', resource: '123456' });
  });

  test('legacy single-segment snowflake → default account', () => {
    expect(Line.parseDiscord('metro://discord/123456')).toEqual({ accountId: 'default', resource: '123456' });
  });

  test('non-numeric channel (resource) → null in both forms', () => {
    expect(Line.parseDiscord('metro://discord/main/not-a-snowflake')).toBeNull();
    expect(Line.parseDiscord('metro://discord/not-a-snowflake')).toBeNull();
  });

  test('three or more segments → null', () => {
    expect(Line.parseDiscord('metro://discord/main/sub/123')).toBeNull();
  });

  test('wrong station / malformed → null', () => {
    expect(Line.parseDiscord('metro://xmtp/123')).toBeNull();
    expect(Line.parseDiscord('garbage')).toBeNull();
  });
});
