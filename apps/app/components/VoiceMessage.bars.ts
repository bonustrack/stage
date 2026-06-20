
const BAR_COUNT = 34;

function hash(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function waveformBars(uri: string, count: number = BAR_COUNT): number[] {
  let seed = hash(uri) || 1;
  const next = (): number => {
    seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5;
    return ((seed >>> 0) % 1000) / 1000;
  };
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const env = 0.45 + 0.5 * Math.sin((i / count) * Math.PI);
    const noise = next();
    out.push(Math.max(0.18, Math.min(1, env * (0.55 + 0.6 * noise))));
  }
  return out;
}
