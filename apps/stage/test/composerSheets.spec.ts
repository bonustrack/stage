import { describe, expect, test } from 'bun:test';
import { canSendPayment, canSendPoll, canSendSignature, SIGNATURE_KINDS } from '../components/composer/sheets.model';

describe('composer sheets model', () => {
  test('a signature request needs something to sign for the chosen kind', () => {
    const empty = { kind: 'personal' as const, desc: '', message: '', json: '' };
    expect(canSendSignature(empty)).toBe(false);
    expect(canSendSignature({ ...empty, desc: 'Sign in to dapp' })).toBe(false);
    expect(canSendSignature({ ...empty, message: '   ' })).toBe(false);
    expect(canSendSignature({ ...empty, message: 'hello' })).toBe(true);
    expect(canSendSignature({ ...empty, json: '{}' })).toBe(false);
    expect(canSendSignature({ ...empty, kind: 'eip712', message: 'hello' })).toBe(false);
    expect(canSendSignature({ ...empty, kind: 'eip712', json: ' \n ' })).toBe(false);
    expect(canSendSignature({ ...empty, kind: 'eip712', json: '{}' })).toBe(true);
  });

  test('the kind choices cover both request kinds, message first', () => {
    expect(SIGNATURE_KINDS.map(k => k.value)).toEqual(['personal', 'eip712']);
    expect(SIGNATURE_KINDS.map(k => k.label)).toEqual(['Message', 'Typed data']);
  });

  test('a poll needs a question and two filled options', () => {
    const poll = { question: 'Lunch?', header: '', options: ['Pizza', 'Sushi'], multi: false };
    expect(canSendPoll(poll)).toBe(true);
    expect(canSendPoll({ ...poll, question: '  ' })).toBe(false);
    expect(canSendPoll({ ...poll, options: ['Pizza', ' '] })).toBe(false);
    expect(canSendPoll({ ...poll, options: ['Pizza', '', 'Sushi'] })).toBe(true);
    expect(canSendPoll({ ...poll, options: ['Pizza'] })).toBe(false);
  });

  test('a payment needs a recipient and an amount', () => {
    const payment = { to: '0xabc', amount: '0.1', note: '' };
    expect(canSendPayment(payment)).toBe(true);
    expect(canSendPayment({ ...payment, to: ' ' })).toBe(false);
    expect(canSendPayment({ ...payment, amount: '' })).toBe(false);
    expect(canSendPayment({ ...payment, note: 'rent', to: '', amount: '' })).toBe(false);
  });
});
