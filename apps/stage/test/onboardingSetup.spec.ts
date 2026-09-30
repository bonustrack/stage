import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupLinks, setupStages, setupTitle, stageLabel, stageState,
} from '../components/onboarding/Onboarding.setup.model';

describe('setupStages', () => {
  test('creates an account with wallet, messaging and optional profile', () => {
    expect(setupStages({})).toEqual(['wallet', 'messaging', 'finishing']);
    expect(setupStages({ profile: true })).toEqual(['wallet', 'messaging', 'profile', 'finishing']);
  });

  test('adds history only for imports and restores', () => {
    expect(setupStages({ restore: true, history: true })).toEqual(['wallet', 'messaging', 'history', 'finishing']);
  });
});

describe('stageState', () => {
  test('marks earlier stages done and later ones pending', () => {
    const stages = setupStages({ history: true });
    expect(stageState('wallet', 'history', stages)).toBe('done');
    expect(stageState('history', 'history', stages)).toBe('active');
    expect(stageState('finishing', 'history', stages)).toBe('pending');
  });
});

describe('setup copy', () => {
  test('shows create or restore progress and a retry on failure', () => {
    expect(setupTitle(null)).toBe('Creating your account');
    expect(setupTitle(null, { restore: true })).toBe('Restoring your account');
    expect(stageLabel('wallet', {})).toBe('Creating your wallet');
    expect(stageLabel('wallet', { restore: true })).toBe('Restoring your wallet');
    expect(setupTitle({ message: 'x', retry: 'restart' })).toBe('Setup needs another try');
    expect(setupHint({ message: 'boom', retry: 'restart' })).toContain('boom');
    expect(setupHint({ message: 'boom', accountId: '0xabc', retry: 'messaging' })).toContain('wallet is ready');
  });

  test('a messaging retry keeps the existing wallet, other failures may start over', () => {
    expect(setupLinks({ message: 'x', retry: 'restart' })).toEqual(['startOver']);
    expect(setupLinks({ message: 'x', accountId: '0xabc', retry: 'messaging' })).toEqual([]);
    expect(setupLinks(null)).toEqual([]);
  });
});
