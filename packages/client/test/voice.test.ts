
import { describe, expect, test } from 'bun:test';
import { VOICE_BAR_COUNT, voiceWaveformBars, voiceBucketRms } from '../src/xmtp/voice';

describe('voiceWaveformBars', () => {
  test('returns VOICE_BAR_COUNT bars in [0,1] and is deterministic', () => {
    const a = voiceWaveformBars('stage://x');
    const b = voiceWaveformBars('stage://x');
    expect(a).toHaveLength(VOICE_BAR_COUNT);
    expect(a).toEqual(b);
    for (const v of a) { expect(v).toBeGreaterThanOrEqual(0); expect(v).toBeLessThanOrEqual(1); }
  });
  test('differs for different keys', () => {
    expect(voiceWaveformBars('a')).not.toEqual(voiceWaveformBars('b'));
  });
});

describe('voiceBucketRms', () => {
  test('normalises PCM into bars with a peak at 1', () => {
    const pcm = new Float32Array(680);
    for (let i = 0; i < pcm.length; i++) pcm[i] = Math.sin(i / 5) * (i / pcm.length);
    const bars = voiceBucketRms(pcm, 8);
    expect(bars).toHaveLength(8);
    expect(Math.max(...bars)).toBeCloseTo(1, 5);
    for (const v of bars) expect(v).toBeGreaterThanOrEqual(0.06);
  });
  test('throws on empty input', () => {
    expect(() => voiceBucketRms(new Float32Array(0), 4)).toThrow();
  });
  test('throws on silent input', () => {
    expect(() => voiceBucketRms(new Float32Array(40), 4)).toThrow();
  });
});
