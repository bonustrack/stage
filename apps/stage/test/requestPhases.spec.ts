import { describe, expect, test } from 'bun:test';
import {
  NO_REQUESTS,
  requestPhases,
  type RequestEvent,
  type RequestPhase,
  type RequestPhases,
} from '../components/conversation/requests.model';

const TYPES: RequestEvent['type'][] = ['send', 'done', 'fail'];
const PHASES: (RequestPhase | undefined)[] = [undefined, 'sending', 'done', 'failed'];

function play(types: RequestEvent['type'][], id = 'a', from: RequestPhases = NO_REQUESTS): RequestPhases {
  return types.reduce((state, type) => requestPhases(state, { type, id }), from);
}

function at(phase: RequestPhase | undefined): RequestPhases {
  return phase === undefined ? NO_REQUESTS : new Map([['a', phase]]);
}

describe('requestPhases', () => {
  test('a request is sent and done', () => {
    expect(play(['send']).get('a')).toBe('sending');
    expect(play(['send', 'done']).get('a')).toBe('done');
  });

  test('a failed request can be sent again', () => {
    expect(play(['send', 'fail']).get('a')).toBe('failed');
    expect(play(['send', 'fail', 'send']).get('a')).toBe('sending');
  });

  test('a second confirmed tap is refused while a request is sending or done', () => {
    for (const phase of ['sending', 'done'] as const) {
      const state = at(phase);
      expect(requestPhases(state, { type: 'send', id: 'a' })).toBe(state);
    }
  });

  test('a done request stays done whatever arrives', () => {
    const state = at('done');
    for (const type of TYPES) expect(requestPhases(state, { type, id: 'a' })).toBe(state);
  });

  test('only the listed moves change the phase', () => {
    const moves = PHASES.flatMap((phase) => {
      const state = at(phase);
      return TYPES.filter((type) => requestPhases(state, { type, id: 'a' }) !== state).map((type) => `${phase ?? 'idle'}:${type}`);
    });
    expect(moves).toEqual(['idle:send', 'sending:done', 'sending:fail', 'failed:send']);
  });

  test('requests do not affect each other', () => {
    const state = play(['send'], 'b', play(['send', 'done']));
    expect([state.get('a'), state.get('b')]).toEqual(['done', 'sending']);
  });
});
