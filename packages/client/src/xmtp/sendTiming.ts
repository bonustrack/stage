export const SEND_PHASES = [
  'xmtp.total', 'client.ready', 'conversation.find', 'conversation.active', 'filter.prepare',
  'filter.account', 'filter.queue', 'filter.preferences', 'filter.keys', 'filter.group_key',
  'filter.sign', 'filter.http', 'sdk.send',
] as const;

export type SendPhase = typeof SEND_PHASES[number];

export interface SendTiming {
  phase: (name: SendPhase) => () => void;
  finish: () => void;
}

export function timeSendPhase<T>(timing: SendTiming | undefined, phase: SendPhase, work: () => Promise<T>): Promise<T> {
  if (!timing) return work();
  const end = timing.phase(phase);
  try { return work().finally(end); }
  catch (err) { end(); throw err; }
}
