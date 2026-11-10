import { describe, expect, test } from 'bun:test';
import {
  SEND_TX_IDLE,
  sendTx,
  sendTxBusy,
  sendTxCanSubmit,
  sendTxError,
  sendTxSent,
  sendTxStatus,
  sendTxSubmitLabel,
  type SendTx,
  type SendTxEvent,
} from '../components/wallet/send.model';

const HASH = '0xabc';
const BASE = 8453;

const SUBMITTING: SendTx = { kind: 'submitting' };
const PENDING: SendTx = { kind: 'pending', hash: HASH, chainId: BASE };
const CONFIRMED: SendTx = { kind: 'confirmed', hash: HASH, chainId: BASE };
const UNCONFIRMED: SendTx = { kind: 'unconfirmed', hash: HASH, chainId: BASE, error: 'rpc down' };
const FAILED: SendTx = { kind: 'failed', error: 'rejected' };
const EVERY_STATE = [SEND_TX_IDLE, SUBMITTING, PENDING, CONFIRMED, UNCONFIRMED, FAILED];
const EVERY_EVENT: SendTxEvent[] = [
  { type: 'submit' },
  { type: 'broadcast', hash: '0xdef', chainId: 1 },
  { type: 'confirmed' },
  { type: 'failed', error: 'late' },
];

function play(events: SendTxEvent[]): SendTx {
  return events.reduce(sendTx, SEND_TX_IDLE);
}

describe('sendTx', () => {
  test('a transfer goes from submit to broadcast to confirmed', () => {
    expect(play([{ type: 'submit' }])).toEqual(SUBMITTING);
    expect(play([{ type: 'submit' }, { type: 'broadcast', hash: HASH, chainId: BASE }])).toEqual(PENDING);
    expect(play([{ type: 'submit' }, { type: 'broadcast', hash: HASH, chainId: BASE }, { type: 'confirmed' }])).toEqual(CONFIRMED);
  });

  test('a failure before broadcast can be sent again', () => {
    const failed = play([{ type: 'submit' }, { type: 'failed', error: 'rejected' }]);
    expect(failed).toEqual(FAILED);
    expect(sendTxCanSubmit(failed)).toBe(true);
    expect(sendTx(failed, { type: 'submit' })).toEqual(SUBMITTING);
  });

  test('a failure after broadcast keeps the hash and can not be sent again', () => {
    const state = play([{ type: 'submit' }, { type: 'broadcast', hash: HASH, chainId: BASE }, { type: 'failed', error: 'rpc down' }]);
    expect(state).toEqual(UNCONFIRMED);
    expect(sendTxCanSubmit(state)).toBe(false);
    expect(sendTx(state, { type: 'submit' })).toBe(state);
  });

  test('a second submit while one is running changes nothing', () => {
    for (const state of [SUBMITTING, PENDING, CONFIRMED, UNCONFIRMED]) expect(sendTx(state, { type: 'submit' })).toBe(state);
  });

  test('a hash never leaves the state once it is there', () => {
    for (const state of [PENDING, CONFIRMED, UNCONFIRMED]) {
      for (const event of EVERY_EVENT) expect(sendTx(state, event)).toMatchObject({ hash: HASH, chainId: BASE });
    }
  });

  test('late events for a settled transfer are ignored', () => {
    for (const state of [SEND_TX_IDLE, CONFIRMED, UNCONFIRMED, FAILED]) {
      for (const event of EVERY_EVENT.slice(1)) expect(sendTx(state, event)).toBe(state);
    }
  });
});

describe('send views', () => {
  test('exactly one of submittable, busy and sent holds in every state', () => {
    for (const state of EVERY_STATE) {
      expect([sendTxCanSubmit(state), sendTxBusy(state), sendTxSent(state)].filter(Boolean)).toHaveLength(1);
    }
  });

  test('the button says what the transfer is doing', () => {
    expect(sendTxSubmitLabel(SEND_TX_IDLE, false)).toBe('Review');
    expect(sendTxSubmitLabel(SEND_TX_IDLE, true)).toBe('Send');
    expect(sendTxSubmitLabel(FAILED, true)).toBe('Send');
    expect(sendTxSubmitLabel(SUBMITTING, true)).toBe('Confirm in wallet…');
    expect(sendTxSubmitLabel(PENDING, true)).toBe('Sending…');
    expect(sendTxSubmitLabel(CONFIRMED, true)).toBe('Sent ✓');
    expect(sendTxSubmitLabel(UNCONFIRMED, true)).toBe('Sent');
  });

  test('the status line shows only with a hash', () => {
    expect(EVERY_STATE.map((state) => sendTxStatus(state)?.label ?? null)).toEqual([
      null,
      null,
      'Pending',
      'Confirmed',
      'Sent, not confirmed yet',
      null,
    ]);
    expect(sendTxStatus(PENDING)).toEqual({ label: 'Pending', hash: HASH, chainId: BASE });
  });

  test('an unconfirmed transfer warns against sending again instead of showing the raw error', () => {
    expect(sendTxError(FAILED)).toBe('rejected');
    expect(sendTxError(UNCONFIRMED)).toMatch(/Check the explorer before you send it again/);
    for (const state of [SEND_TX_IDLE, SUBMITTING, PENDING, CONFIRMED]) expect(sendTxError(state)).toBeNull();
  });
});
