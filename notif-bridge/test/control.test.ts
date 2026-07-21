import { describe, expect, test } from 'bun:test';
import { CTRL_DISABLE_PUSH, CTRL_REGISTER_PUSH, isControlBody, parseControlBody } from '../src/control.ts';

describe('isControlBody', () => {
  test('detects the METRO_CTRL prefix only', () => {
    expect(isControlBody('METRO_CTRL:register-push:{}')).toBe(true);
    expect(isControlBody('hello')).toBe(false);
    expect(isControlBody(42)).toBe(false);
  });
});

describe('parseControlBody', () => {
  test('parses a valid register-push body', () => {
    const token = 'f'.repeat(140);
    const body = `METRO_CTRL:register-push:${JSON.stringify({ v: 1, token, platform: 'android', address: '0xABC', inboxId: 'inbox' })}`;
    const parsed = parseControlBody(body);
    expect(parsed?.verb).toBe(CTRL_REGISTER_PUSH);
    expect(parsed?.payload?.token).toBe(token);
    if (parsed?.verb === CTRL_REGISTER_PUSH) {
      expect(parsed.payload?.platform).toBe('android');
    }
  });

  test('parses a valid disable-push body', () => {
    const token = 'a'.repeat(30);
    const body = `METRO_CTRL:disable-push:${JSON.stringify({ v: 1, token })}`;
    const parsed = parseControlBody(body);
    expect(parsed?.verb).toBe(CTRL_DISABLE_PUSH);
    expect(parsed?.payload?.token).toBe(token);
  });

  test('rejects short/missing tokens (payload null)', () => {
    const body = `METRO_CTRL:register-push:${JSON.stringify({ token: 'short' })}`;
    const parsed = parseControlBody(body);
    expect(parsed?.verb).toBe(CTRL_REGISTER_PUSH);
    expect(parsed?.payload).toBeNull();
  });

  test('returns null for non-control bodies', () => {
    expect(parseControlBody('just a message')).toBeNull();
  });

  test('unknown verb yields null payload, never throws', () => {
    const parsed = parseControlBody('METRO_CTRL:mystery:not-json');
    expect(parsed?.verb).toBe('mystery');
    expect(parsed?.payload).toBeNull();
  });
});
