import { attempt } from './errorPolicy';

const PHASES = [
  'xmtp.total', 'client.ready', 'conversation.find', 'conversation.active', 'filter.prepare',
  'filter.account', 'filter.queue', 'filter.preferences', 'filter.keys', 'filter.group_key',
  'filter.sign', 'filter.http', 'sdk.send',
] as const;
const ALLOWED_PHASES = new Set<string>(PHASES);
const MAX_SENDS = 10;
const MAX_PHASES = 64;

type SendPhase = typeof PHASES[number];
interface Sample { phase: SendPhase; durationMs: number }

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

export function makeSendTimingDiagnostic(now = () => performance.now()) {
  let enabled = false;
  let generation = 0;
  const completed: Sample[][] = [];
  const pending = new Set<Sample[]>();
  const clock = (): number => {
    let value = Number.NaN;
    attempt(() => { value = now(); }, 'probe');
    return value;
  };
  const clear = (): void => {
    generation += 1;
    completed.length = 0;
    for (const samples of pending) samples.length = 0;
    pending.clear();
  };
  const stop = (): void => { enabled = false; clear(); };
  const start = (): void => { clear(); enabled = true; };
  const read = (): Sample[][] => completed.map(samples => samples.map(({ phase, durationMs }) => ({ phase, durationMs })));

  function begin(): SendTiming | undefined {
    if (!enabled || pending.size >= MAX_SENDS) return undefined;
    const session = generation;
    const samples: Sample[] = [];
    pending.add(samples);
    let finished = false;
    const open = new Set<() => void>();
    const current = (): boolean => enabled && generation === session && !finished;
    const record = (phase: SendPhase, started: number): void => {
      const durationMs = Math.round((clock() - started) * 10) / 10;
      if (Number.isFinite(durationMs) && durationMs >= 0) samples.push({ phase, durationMs });
    };
    const totalStarted = clock();
    const phase = (name: SendPhase): (() => void) => {
      if (!current() || !ALLOWED_PHASES.has(name) || samples.length + open.size >= MAX_PHASES - 1) return () => undefined;
      const started = clock();
      let ended = false;
      const end = (): void => {
        if (ended) return;
        ended = true;
        open.delete(end);
        if (current()) record(name, started);
      };
      open.add(end);
      return end;
    };
    const finish = (): void => {
      if (!current()) return;
      for (const end of open) end();
      record('xmtp.total', totalStarted);
      finished = true;
      pending.delete(samples);
      completed.push(samples);
      if (completed.length > MAX_SENDS) completed.shift();
    };
    return { phase, finish };
  }

  return { start, stop, clear, read, begin };
}
