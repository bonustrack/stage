
import { describe, expect, test } from 'bun:test';
import { githubLinkOf } from '../src/api/github';

describe('githubLinkOf', () => {
  test('detects a bare repo link', () => {
    expect(githubLinkOf('see https://github.com/bonustrack/metro for code')).toMatchObject({
      owner: 'bonustrack', repo: 'metro', kind: 'repo', number: undefined,
    });
  });

  test('detects a PR link with number', () => {
    expect(githubLinkOf('https://github.com/bonustrack/metro/pull/321')).toMatchObject({
      kind: 'pull', number: 321,
    });
  });

  test('detects an issue link with number', () => {
    expect(githubLinkOf('https://github.com/bonustrack/metro/issues/325')).toMatchObject({
      kind: 'issue', number: 325,
    });
  });

  test('strips a trailing .git from the repo', () => {
    expect(githubLinkOf('https://github.com/foo/bar.git')?.repo).toBe('bar');
  });

  test('ignores GitHub feature paths (orgs, settings, ...)', () => {
    expect(githubLinkOf('https://github.com/orgs/bonustrack')).toBeNull();
    expect(githubLinkOf('https://github.com/settings/profile')).toBeNull();
  });

  test('returns null for non-github / empty text', () => {
    expect(githubLinkOf('https://gitlab.com/a/b')).toBeNull();
    expect(githubLinkOf('')).toBeNull();
    expect(githubLinkOf(null)).toBeNull();
  });
});
