import { ignore } from './errorPolicy';

const TONE_HZ = [480, 620] as const;
const TONE_S = 0.35;
const EVERY_MS = 2_000;

export function startRingtone(): () => void {
  if (typeof AudioContext !== 'function') return () => undefined;
  const ctx = new AudioContext();
  const ring = (): void => {
    TONE_HZ.forEach((hz, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * TONE_S;
      osc.frequency.value = hz;
      gain.gain.value = 0.06;
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + TONE_S);
    });
  };
  ring();
  const timer = setInterval(ring, EVERY_MS);
  return () => {
    clearInterval(timer);
    ignore(ctx.close(), 'cleanup');
  };
}
