import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { previewOfXmtpContent } from '@stage-labs/client/xmtp/humanize';

const APP_ROOT = join(import.meta.dir, '..');
const read = (...p: string[]) => readFileSync(join(APP_ROOT, ...p), 'utf8');

const nativeSeam = read('lib', 'xmtp.stream.ts');
const webSeam = read('lib', 'xmtp.stream.web.ts');
const nativeTypes = read('lib', 'xmtp.types.ts');
const webTypes = read('lib', 'xmtp.types.web.ts');
const consumer = read('components', 'tabs', 'HomeScreen.stream.ts');

describe('streamed messages reach subscribers in one platform-neutral shape', () => {
  test('both seams normalise before fanning out', () => {
    for (const src of [nativeSeam, webSeam]) {
      expect(src).toContain('function streamedMessageOf(');
      expect(src).toContain('): StreamedMessage {');
      expect(src).toContain('const normalized = streamedMessageOf(msg);');
      expect(src).toContain('msg: normalized');
    }
  });

  test('both StreamMsg types carry the normalised shape, not a raw sdk message', () => {
    for (const src of [nativeTypes, webTypes]) {
      expect(src).toContain('msg: StreamedMessage;');
      expect(src).not.toContain('msg: DecodedMessage;');
    }
  });

  test('the web seam reads content as a property and derives the type id', () => {
    expect(webSeam).toContain('content: msg.content,');
    expect(webSeam).toContain('contentTypeId: msg.contentType.typeId,');
    expect(webSeam).toContain('sentNs: Number(msg.sentAtNs),');
  });

  test('the native seam still calls content() and guards it', () => {
    expect(nativeSeam).toContain('try { content = msg.content(); } catch { content = undefined; }');
    expect(nativeSeam).toContain('contentTypeId: msg.contentTypeId,');
    expect(nativeSeam).toContain('sentNs: msg.sentNs,');
  });

  test('the channels-list consumer never invokes content as a function', () => {
    expect(consumer).toContain('const decoded = msg.content;');
    expect(consumer).not.toContain('msg.content()');
  });
});

describe('a streamed text message previews as its text, never as a type placeholder', () => {
  test('plain text survives the preview path', () => {
    expect(previewOfXmtpContent('Hey', 'text')).toBe('Hey');
  });

  test('a missing content type is what produces the [unknown] placeholder', () => {
    expect(previewOfXmtpContent({ some: 'object' }, undefined)).toBe('[unknown]');
  });
});
