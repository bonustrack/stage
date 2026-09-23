import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupLinks, setupStages, setupTitle, stageLabel, stageState,
} from '../components/onboarding/Onboarding.setup.model';
import { passkeyStepCopy, passkeyStepSkippable } from '../components/onboarding/Onboarding.steps.model';

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
  test('a wallet that already has a passkey is asked to confirm it', () => {
    expect(passkeyStepCopy('verify').title).toBe('Confirm your passkey');
    expect(passkeyStepCopy('add').title).toBe('Add a passkey');
  });
});

describe('restore never blocks on a passkey', () => {
  test('confirming a passkey always offers a way past it', () => {
    expect(passkeyStepCopy('verify').skip).toBe('Continue without passkey');
    expect(passkeyStepCopy('verify', 'No passkey found.').skip).toBe('Continue without passkey');
    expect(passkeyStepCopy('verify', 'No passkey found.').body).toContain('add a passkey for this device later');
    expect(passkeyStepCopy('verify', 'No passkey found.').action).toBe('Try again');
    expect(passkeyStepSkippable('verify', null)).toBe(true);
    expect(passkeyStepSkippable('verify', 'No passkey found.')).toBe(true);
  });

  test('adding a new passkey keeps its skip until an error, with no extra link', () => {
    expect(passkeyStepCopy('add').skip).toBeNull();
    expect(passkeyStepSkippable('add', null)).toBe(true);
    expect(passkeyStepSkippable('add', 'x')).toBe(false);
  });

  test('a passkey failure during setup can continue without it', () => {
    expect(setupLinks({ message: 'x', accountId: '0xabc', retry: 'passkey' })).toEqual(['skipPasskey', 'startOver']);
    expect(setupLinks({ message: 'x', retry: 'passkey' })).toEqual(['startOver']);
    expect(setupLinks({ message: 'x', retry: 'restart' })).toEqual(['startOver']);
    expect(setupLinks({ message: 'x', accountId: '0xabc', retry: 'messaging' })).toEqual([]);
    expect(setupLinks(null)).toEqual([]);
    expect(setupHint({ message: 'Dismissed.', accountId: '0xabc', retry: 'passkey' })).toContain('continue without a passkey');
  });

  test('the stage list for a restore without a passkey skips the passkey stage', () => {
    expect(setupStages({ restore: true, history: true })).toEqual(['wallet', 'messaging', 'history', 'finishing']);
  });
});
