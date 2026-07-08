import { describe, expect, test } from 'bun:test';
import { bubbleFallbackText, bubbleFallbackShape } from '../components/MessengerBubble.boundary.model';

const PLACEHOLDER = '(this message could not be displayed)';

describe('bubbleFallbackText', () => {
  test('renders the envelope plain text when present', () => {
    const out = bubbleFallbackText({ text: 'gm from Less', payload: { contentType: 'text' } });
    expect(out).toBe('gm from Less');
    expect(out).not.toBe(PLACEHOLDER);
  });

  test('trims surrounding whitespace', () => {
    expect(bubbleFallbackText({ text: '  hello  ', payload: undefined })).toBe('hello');
  });

  test('renders the xmtp fallback string carried in text for unknown types', () => {
    const out = bubbleFallbackText({ text: '[some codec fallback]', payload: { contentType: 'weird' } });
    expect(out).toBe('[some codec fallback]');
  });

  test('falls back to content type name when text is empty', () => {
    expect(bubbleFallbackText({ text: '', payload: { contentType: 'reaction' } }))
      .toBe('Unsupported message (reaction)');
    expect(bubbleFallbackText({ text: '   ', payload: { contentType: 'reply' } }))
      .toBe('Unsupported message (reply)');
  });

  test('falls back to generic label when neither text nor content type exist', () => {
    expect(bubbleFallbackText({ text: undefined, payload: undefined })).toBe('Unsupported message');
    expect(bubbleFallbackText({ text: '', payload: {} })).toBe('Unsupported message');
  });

  test('never returns the undisplayable placeholder for well-formed or malformed entries', () => {
    const entries = [
      { text: 'plain', payload: { contentType: 'text' } },
      { text: '', payload: { contentType: 'poll' } },
      { text: undefined, payload: undefined },
      { text: '', payload: { contentType: 123 as unknown } },
    ];
    for (const e of entries) expect(bubbleFallbackText(e)).not.toBe(PLACEHOLDER);
  });
});

describe('bubbleFallbackShape', () => {
  test('reports content type and text presence for diagnostics', () => {
    expect(bubbleFallbackShape({ text: 'hi', payload: { contentType: 'text' } }))
      .toEqual({ contentType: 'text', hasText: true, textLength: 2 });
    expect(bubbleFallbackShape({ text: '', payload: { contentType: 'reply' } }))
      .toEqual({ contentType: 'reply', hasText: false, textLength: 0 });
    expect(bubbleFallbackShape({ text: undefined, payload: undefined }))
      .toEqual({ contentType: undefined, hasText: false, textLength: 0 });
  });
});
