/**
 * Unit tests for `src/schema.ts` — the typed metro-call / METRO_CTRL schema (#16).
 * Pure in-process; no fs / network.
 */

import { describe, expect, test } from 'bun:test';
import {
  v, SchemaError, METRO_CTRL_PREFIX, isControlPayload, parseControl,
  isKnownCtrlVerb, validateCtrl, parseAndValidateControl, RegisterPushSchema,
} from '../src/schema.ts';

describe('validator combinators', () => {
  test('string min/max', () => {
    expect(v.string()('hi')).toBe('hi');
    expect(() => v.string({ min: 3 })('hi')).toThrow(SchemaError);
    expect(() => v.string()(5 as unknown)).toThrow(SchemaError);
  });
  test('optional passes through null/undefined', () => {
    expect(v.optional(v.string())(undefined)).toBeUndefined();
    expect(v.optional(v.string())(null)).toBeUndefined();
    expect(v.optional(v.string())('x')).toBe('x');
  });
  test('object drops unknown keys and scopes the error path', () => {
    const s = v.object({ a: v.string(), b: v.optional(v.number()) });
    expect(s({ a: 'x', extra: 1 })).toEqual({ a: 'x', b: undefined });
    try { s({ a: 5 }); throw new Error('should have thrown'); }
    catch (err) { expect((err as SchemaError).path).toBe('a'); }
  });
  test('literal + array', () => {
    expect(v.literal('added', 'removed')('removed')).toBe('removed');
    expect(() => v.literal('added')('nope')).toThrow(SchemaError);
    expect(v.array(v.number())([1, 2])).toEqual([1, 2]);
  });
});

describe('METRO_CTRL parsing', () => {
  test('isControlPayload', () => {
    expect(isControlPayload(`${METRO_CTRL_PREFIX}register-push:{}`)).toBe(true);
    expect(isControlPayload('hello')).toBe(false);
    expect(isControlPayload(5)).toBe(false);
  });
  test('parseControl splits verb + json', () => {
    expect(parseControl(`${METRO_CTRL_PREFIX}register-push:{"token":"x"}`))
      .toEqual({ verb: 'register-push', rawJson: '{"token":"x"}' });
    expect(parseControl('not control')).toBeNull();
    expect(parseControl(`${METRO_CTRL_PREFIX}bare-verb`))
      .toEqual({ verb: 'bare-verb', rawJson: '' });
  });
});

describe('verb validation', () => {
  test('isKnownCtrlVerb', () => {
    expect(isKnownCtrlVerb('register-push')).toBe(true);
    expect(isKnownCtrlVerb('bogus')).toBe(false);
  });
  test('register-push requires a 20+ char token', () => {
    const tok = 'a'.repeat(40);
    expect(RegisterPushSchema({ token: tok, account: 'tony' }))
      .toMatchObject({ token: tok, account: 'tony' });
    expect(() => validateCtrl('register-push', { token: 'short' })).toThrow(SchemaError);
  });
  test('validateCtrl parses a raw JSON string (DM path)', () => {
    const tok = 'b'.repeat(30);
    expect(validateCtrl('register-push', JSON.stringify({ token: tok })))
      .toMatchObject({ token: tok });
  });
  test('validateCtrl throws on unknown verb', () => {
    expect(() => validateCtrl('nope', {})).toThrow(/unknown control verb/);
  });
  test('parseAndValidateControl end-to-end; ignores unknown verbs', () => {
    const tok = 'c'.repeat(25);
    const ok = parseAndValidateControl(`${METRO_CTRL_PREFIX}register-push:${JSON.stringify({ token: tok })}`);
    expect(ok?.verb).toBe('register-push');
    expect((ok?.value as { token: string }).token).toBe(tok);
    expect(parseAndValidateControl(`${METRO_CTRL_PREFIX}unknown-verb:{}`)).toBeNull();
    expect(parseAndValidateControl('plain chat')).toBeNull();
  });
});
