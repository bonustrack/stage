export type RequestPhase = 'sending' | 'done' | 'failed';

export type RequestPhases = ReadonlyMap<string, RequestPhase>;

export interface RequestEvent {
  type: 'send' | 'done' | 'fail';
  id: string;
}

export const NO_REQUESTS: RequestPhases = new Map();

const ALLOWED_FROM: Record<RequestEvent['type'], readonly (RequestPhase | undefined)[]> = {
  send: [undefined, 'failed'],
  done: ['sending'],
  fail: ['sending'],
};

const PHASE_AFTER: Record<RequestEvent['type'], RequestPhase> = { send: 'sending', done: 'done', fail: 'failed' };

export function requestPhases(state: RequestPhases, event: RequestEvent): RequestPhases {
  if (!ALLOWED_FROM[event.type].includes(state.get(event.id))) return state;
  return new Map(state).set(event.id, PHASE_AFTER[event.type]);
}
