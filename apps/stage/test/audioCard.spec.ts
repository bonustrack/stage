import { describe, expect, test } from 'bun:test';
import {
  audioByteSize,
  audioCardModel,
  base64ByteLength,
  clockLabel,
  isVoiceNote,
  seekFraction,
} from '../components/bubble/audioCard.model';

describe('audio card', () => {
  test('keeps recorded voice notes on the waveform pill', () => {
    expect(isVoiceNote({ name: 'voice-1727450000000.m4a' })).toBe(true);
    expect(isVoiceNote({ name: 'voice.m4a' })).toBe(true);
    expect(isVoiceNote({ name: 'Voice_memo.m4a' })).toBe(true);
    expect(isVoiceNote({})).toBe(true);
    expect(isVoiceNote({ name: '  ' })).toBe(true);
    expect(isVoiceNote({ name: 'voiceover-take2.mp3' })).toBe(false);
    expect(isVoiceNote({ name: 'designing-grok-bot.mp3' })).toBe(false);
  });

  test('formats a playback clock', () => {
    expect(clockLabel(0)).toBe('0:00');
    expect(clockLabel(1_999)).toBe('0:01');
    expect(clockLabel(188_000)).toBe('3:08');
    expect(clockLabel(3_725_000)).toBe('1:02:05');
    expect(clockLabel(Number.NaN)).toBe('0:00');
    expect(clockLabel(-5_000)).toBe('0:00');
  });

  test('measures inline audio from its base64 payload', () => {
    expect(base64ByteLength('AAAA')).toBe(3);
    expect(base64ByteLength('AAA=')).toBe(2);
    expect(base64ByteLength('AA==')).toBe(1);
    expect(base64ByteLength('AAAA\r\nAA==\r\n')).toBe(4);
    expect(audioByteSize({ dataB64: 'AAAA' })).toBe(3);
    expect(audioByteSize({ size: 42, dataB64: 'AAAA' })).toBe(42);
    expect(audioByteSize({})).toBeUndefined();
  });

  test('maps a pointer offset to a clamped seek fraction', () => {
    expect(seekFraction(50, 200)).toBe(0.25);
    expect(seekFraction(-10, 200)).toBe(0);
    expect(seekFraction(250, 200)).toBe(1);
    expect(seekFraction(10, 0)).toBe(0);
    expect(seekFraction(Number.NaN, 200)).toBe(0);
  });

  test('shows length and size once the duration is known', () => {
    const att = { name: 'designing-grok-bot-with-grok-bot.mp3', size: 1_258_291 };
    expect(audioCardModel(att, { position: 1_000, duration: 188_000 })).toEqual({
      title: 'designing-grok-bot-with-grok-bot.mp3',
      subtitle: '3:08 · 1.2 MB',
      time: '0:01 / 3:08',
      progress: 1_000 / 188_000,
    });
  });

  test('falls back to the size and a bare clock before the duration loads', () => {
    expect(audioCardModel({ name: ' ', size: 2_048 }, { position: 0, duration: 0 })).toEqual({
      title: 'Audio',
      subtitle: '2 KB',
      time: '0:00',
      progress: 0,
    });
  });
});
