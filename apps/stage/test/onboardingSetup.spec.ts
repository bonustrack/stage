import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupStages, setupTitle, stageLabel, stageState,
} from '../components/onboarding/Onboarding.setup.model';
import { passkeyStepCopy } from '../components/onboarding/Onboarding.steps.model';

describe('setupStages', () => {
  test('adds the history stage only for imports and restores', () => {
    expect(setupStages({})).toEqual(['wallet', 'messaging', 'finishing']);
    expect(setupStages({ history: true })).toEqual(['wallet', 'messaging', 'history', 'finishing']);
    expect(setupStages({ profile: true })).toEqual(['wallet', 'messaging', 'profile', 'finishing']);
    expect(setupStages({ passkey: 'add', profile: true })).toEqual(['wallet', 'passkey', 'messaging', 'profile', 'finishing']);
    expect(setupStages({ restore: true, passkey: 'verify' })).toEqual(['wallet', 'passkey', 'messaging', 'finishing']);
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
    expect(setupTitle(null)).toBe('Creating your account');
    expect(setupTitle(null, { restore: true })).toBe('Restoring your account');
    expect(stageLabel('wallet', {})).toBe('Creating your wallet');
    expect(stageLabel('wallet', { restore: true })).toBe('Restoring your wallet');
    expect(setupTitle({ message: 'x', retry: 'restart' })).toBe('Setup needs another try');
    expect(setupTitle({ message: 'x', accountId: '0xabc', retry: 'passkey' })).toBe('Passkey not added');
    expect(setupTitle({ message: 'x', accountId: '0xabc', retry: 'passkey' }, { passkey: 'verify' })).toBe('Passkey not confirmed');
    expect(setupTitle(null, { passkey: 'verify' })).toBe('Creating your account');
    expect(stageLabel('passkey', { passkey: 'verify' })).toBe('Confirming your passkey');
    expect(setupHint({ message: 'boom', retry: 'restart' })).toContain('boom');
    expect(setupHint({ message: 'boom', accountId: '0xabc', retry: 'messaging' })).toContain('wallet is ready');
    expect(setupHint({ message: 'Dismissed.', accountId: '0xabc', retry: 'passkey' })).toContain('start over');
  });
});

describe('passkeyStepCopy', () => {
  test('a wallet that already has a passkey must confirm it and cannot skip', () => {
    const verify = passkeyStepCopy('verify');
    expect(verify.skippable).toBe(false);
    expect(verify.title).toBe('Confirm your passkey');
    expect(passkeyStepCopy('add')).toMatchObject({ skippable: true, title: 'Add a passkey' });
  });
});
