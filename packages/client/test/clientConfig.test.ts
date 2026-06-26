import { describe, expect, test } from 'bun:test';
import {
  webXmtpDbPath, canReuseSavedClient, installationCreatedAtMs,
} from '../src/xmtp/clientConfig';
import { dbDirFor } from '../src/accounts/registry';

describe('webXmtpDbPath', () => {
  test('matches inline derivation', () => {
    expect(webXmtpDbPath('acct1', 'production')).toBe(`${dbDirFor('acct1')}-production.db3`);
    expect(webXmtpDbPath('acct1', 'dev')).toBe(`${dbDirFor('acct1')}-dev.db3`);
  });
});

describe('canReuseSavedClient', () => {
  test('true when address case-insensitively equal and env equal', () => {
    expect(canReuseSavedClient('0xABC', 'production', '0xabc', 'production')).toBe(true);
  });
  test('false on env mismatch', () => {
    expect(canReuseSavedClient('0xabc', 'dev', '0xabc', 'production')).toBe(false);
  });
  test('false on address mismatch', () => {
    expect(canReuseSavedClient('0xdef', 'production', '0xabc', 'production')).toBe(false);
  });
  test('false when nothing saved', () => {
    expect(canReuseSavedClient(null, null, '0xabc', 'production')).toBe(false);
  });
});

describe('installationCreatedAtMs', () => {
  test('ns to ms', () => {
    expect(installationCreatedAtMs(2_000_000n)).toBe(2);
  });
  test('null/undefined passthrough', () => {
    expect(installationCreatedAtMs(null)).toBeNull();
    expect(installationCreatedAtMs(undefined)).toBeNull();
  });
});
