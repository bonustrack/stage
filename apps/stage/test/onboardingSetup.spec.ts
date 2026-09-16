import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupStages, setupTitle, stageLabel, stageState,
} from '../components/onboarding/Onboarding.setup.model';

describe('setupStages', () => {
  test('adds the history stage only for imports and restores', () => {
    expect(setupStages({})).toEqual(['wallet', 'messaging', 'finishing']);
    expect(setupStages({ history: true })).toEqual(['wallet', 'messaging', 'history', 'finishing']);
    expect(setupStages({ profile: true })).toEqual(['wallet', 'messaging', 'profile', 'finishing']);
    expect(setupStages({ passkey: true, profile: true })).toEqual(['wallet', 'passkey', 'messaging', 'profile', 'finishing']);
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
  test('switches to the retry title and hint on error', () => {
    expect(setupTitle('messaging', null)).toBe('Setting up secure messaging');
    expect(setupTitle('wallet', null, { restore: true })).toBe('Restoring your wallet');
    expect(stageLabel('wallet', {})).toBe('Creating your wallet');
    expect(stageLabel('wallet', { restore: true })).toBe('Restoring your wallet');
    expect(setupTitle('messaging', { message: 'x', retry: 'restart' })).toBe('Setup needs another try');
    expect(setupTitle('passkey', { message: 'x', accountId: '0xabc', retry: 'passkey' })).toBe('Passkey not added');
    expect(setupHint('messaging', { message: 'boom', retry: 'restart' })).toContain('boom');
    expect(setupHint('messaging', { message: 'boom', accountId: '0xabc', retry: 'messaging' })).toContain('wallet is ready');
    expect(setupHint('passkey', { message: 'Dismissed.', accountId: '0xabc', retry: 'passkey' })).toContain('start over');
  });
});
