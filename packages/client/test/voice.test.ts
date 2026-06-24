
import { describe, expect, test } from 'bun:test';
import {
  VOICE_BAR_COUNT, voiceFilename, voiceMimeAndExt, isVoiceAttachment,
  formatVoiceDuration, voiceWaveformBars, voiceBucketRms,
} from '../src/xmtp/voice';

describe('voiceMimeAndExt', () => {
  test('strips codecs clause and maps webm/opus', () => {
    expect(voiceMimeAndExt('audio/webm;codecs=opus')).toEqual({ mime: 'audio/webm', ext: 'webm' });
  });
  test('maps mp4 to m4a extension', () => {
    expect(voiceMimeAndExt('audio/mp4')).toEqual({ mime: 'audio/mp4', ext: 'm4a' });
  });
  test('falls back to webm for unknown', () => {
    expect(voiceMimeAndExt('')).toEqual({ mime: 'audio/webm', ext: 'webm' });
  });
});

describe('voiceFilename', () => {
  test('uses timestamp and extension', () => {
    expect(voiceFilename(1234, 'webm')).toBe('voice-1234.webm');
  });
  test('defaults to m4a', () => {
    expect(voiceFilename(99)).toBe('voice-99.m4a');
  });
});

describe('isVoiceAttachment', () => {
  test('true for audio mimes', () => {
    expect(isVoiceAttachment('audio/webm')).toBe(true);
    expect(isVoiceAttachment('audio/m4a')).toBe(true);
  });
  test('false otherwise', () => {
    expect(isVoiceAttachment('image/png')).toBe(false);
    expect(isVoiceAttachment(undefined)).toBe(false);
    expect(isVoiceAttachment(null)).toBe(false);
  });
});

describe('formatVoiceDuration', () => {
  test('formats minutes and seconds', () => {
    expect(formatVoiceDuration(0)).toBe('0:00');
    expect(formatVoiceDuration(undefined)).toBe('0:00');
    expect(formatVoiceDuration(5000)).toBe('0:05');
    expect(formatVoiceDuration(65000)).toBe('1:05');
  });
});

describe('voiceWaveformBars', () => {
  test('returns VOICE_BAR_COUNT bars in [0,1] and is deterministic', () => {
    const a = voiceWaveformBars('metro://x');
    const b = voiceWaveformBars('metro://x');
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
