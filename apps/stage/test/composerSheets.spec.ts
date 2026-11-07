import { describe, expect, test } from 'bun:test';
import { checkPaymentDraft, checkPollDraft, checkSignatureDraft, SIGNATURE_KINDS } from '../components/composer/sheets.model';

const canSendSignature = (d: Parameters<typeof checkSignatureDraft>[0]) => checkSignatureDraft(d).filled;
const canSendPoll = (d: Parameters<typeof checkPollDraft>[0]) => checkPollDraft(d).filled;
const canSendPayment = (d: Parameters<typeof checkPaymentDraft>[0]) => checkPaymentDraft(d).filled;

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
    expect(SIGNATURE_KINDS.map((k) => k.value)).toEqual(['personal', 'eip712']);
    expect(SIGNATURE_KINDS.map((k) => k.label)).toEqual(['Message', 'Typed data']);
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

  test('the send uses the same check and explains what is wrong with a filled draft', () => {
    expect(checkPaymentDraft({ to: '0xabc', amount: '0.1', note: '' })).toEqual({
      filled: true,
      ok: false,
      message: 'Enter a valid recipient address',
    });
    const to = '0x000000000000000000000000000000000000dEaD';
    expect(checkPaymentDraft({ to, amount: '-1', note: '' })).toEqual({ filled: true, ok: false, message: 'Enter a valid amount' });
    expect(checkPaymentDraft({ to: ` ${to} `, amount: ' 0.5 ', note: '' })).toEqual({
      filled: true,
      ok: true,
      value: { to, amount: '0.5', units: 0.5 },
    });
    expect(checkPollDraft({ question: ' Lunch? ', header: ' Team ', options: ['Pizza', ' ', 'Sushi '], multi: true })).toEqual({
      filled: true,
      ok: true,
      value: { question: 'Lunch?', header: 'Team', options: [{ label: 'Pizza' }, { label: 'Sushi' }], multiSelect: true },
    });
    expect(checkPollDraft({ question: '', header: '', options: [], multi: false })).toMatchObject({
      ok: false,
      message: 'Add a question and at least 2 options',
    });
    const typed = checkSignatureDraft({ kind: 'eip712', desc: '', message: '', json: '{' });
    expect(typed.filled && !typed.ok).toBe(true);
  });
});
