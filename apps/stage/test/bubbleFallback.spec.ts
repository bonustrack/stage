import { describe, expect, test } from 'bun:test';
import { bubbleFallbackText } from '../components/bubble/boundary.model';

describe('bubbleFallbackText', () => {
  test('renders the envelope plain text when present', () => {
    expect(bubbleFallbackText({ text: 'gm from Less', payload: { contentType: 'text' } })).toBe('gm from Less');
  });

  test('trims surrounding whitespace', () => {
    expect(bubbleFallbackText({ text: '  hello  ', payload: undefined })).toBe('hello');
  });

  test('renders the xmtp fallback string carried in text for unknown types', () => {
    const out = bubbleFallbackText({ text: '[some codec fallback]', payload: { contentType: 'weird' } });
    expect(out).toBe('[some codec fallback]');
  });

  test('falls back to content type name when text is empty', () => {
    expect(bubbleFallbackText({ text: '', payload: { contentType: 'reaction' } })).toBe('Unsupported message (reaction)');
    expect(bubbleFallbackText({ text: '   ', payload: { contentType: 'reply' } })).toBe('Unsupported message (reply)');
  });

  test('falls back to generic label when neither text nor content type exist', () => {
    expect(bubbleFallbackText({ text: undefined, payload: undefined })).toBe('Unsupported message');
  });
});
