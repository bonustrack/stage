import { expect, test } from 'bun:test';
import { parseMeta } from '../src/parse.ts';

const page = (ogUrl: string): string => `<html><head><meta property="og:url" content="${ogUrl}"><title>T</title></head></html>`;

test('og:url on the fetched host is kept', () => {
  expect(parseMeta(page('https://news.example/story'), 'https://news.example/s?id=1').url).toBe('https://news.example/story');
});

test('og:url pointing at another host falls back to the fetched URL', () => {
  expect(parseMeta(page('https://evil.example/login'), 'https://news.example/s').url).toBe('https://news.example/s');
});

test('og:url with a script scheme falls back to the fetched URL', () => {
  expect(parseMeta(page('javascript:alert(1)'), 'https://news.example/s').url).toBe('https://news.example/s');
});
