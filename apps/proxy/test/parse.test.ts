import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseMeta } from '../src/parse.ts';

const page = (ogUrl: string): string => `<html><head><meta property="og:url" content="${ogUrl}"><title>T</title></head></html>`;

void test('og:url on the fetched host is kept', () => {
  assert.equal(parseMeta(page('https://news.example/story'), 'https://news.example/s?id=1').url, 'https://news.example/story');
});

void test('og:url pointing at another host falls back to the fetched URL', () => {
  assert.equal(parseMeta(page('https://evil.example/login'), 'https://news.example/s').url, 'https://news.example/s');
});

void test('og:url with a script scheme falls back to the fetched URL', () => {
  assert.equal(parseMeta(page('javascript:alert(1)'), 'https://news.example/s').url, 'https://news.example/s');
});
