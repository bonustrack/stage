import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupLinks, setupStages, setupTitle, stageLabel, stageState,
} from '../components/onboarding/Onboarding.setup.model';
import { PASSKEY_STEP_COPY } from '../components/onboarding/Onboarding.steps.model';
import { RESTORE_OFFER_COPY, restoreOffer, type RestoreOfferInput } from '../components/onboarding/restoreOffer.model';

describe('setupStages', () => {
  test('adds the history stage only for imports and restores', () => {
    expect(setupStages({})).toEqual(['wallet', 'messaging', 'finishing']);
    expect(setupStages({ history: true })).toEqual(['wallet', 'messaging', 'history', 'finishing']);
    expect(setupStages({ profile: true })).toEqual(['wallet', 'messaging', 'profile', 'finishing']);
    expect(setupStages({ passkey: 'add', profile: true })).toEqual(['wallet', 'passkey', 'messaging', 'profile', 'finishing']);
  });

  test('a restore never has a passkey stage', () => {
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
  test('switches to the retry title and hint on error', () => {
    expect(setupTitle(null)).toBe('Creating your account');
    expect(setupTitle(null, { restore: true })).toBe('Restoring your account');
    expect(stageLabel('wallet', {})).toBe('Creating your wallet');
    expect(stageLabel('wallet', { restore: true })).toBe('Restoring your wallet');
    expect(stageLabel('passkey', { passkey: 'add' })).toBe('Adding your passkey');
    expect(setupTitle({ message: 'x', retry: 'restart' })).toBe('Setup needs another try');
    expect(setupTitle({ message: 'x', accountId: '0xabc', retry: 'passkey' })).toBe('Passkey not added');
    expect(setupHint({ message: 'boom', retry: 'restart' })).toContain('boom');
    expect(setupHint({ message: 'boom', accountId: '0xabc', retry: 'messaging' })).toContain('wallet is ready');
    expect(setupHint({ message: 'Dismissed.', accountId: '0xabc', retry: 'passkey' })).toContain('start over');
  });

  test('the passkey step is optional and keeps the recovery phrase as the main key', () => {
    expect(PASSKEY_STEP_COPY.title).toBe('Add a passkey');
    expect(PASSKEY_STEP_COPY.skip).toBe('Skip for now');
    expect(PASSKEY_STEP_COPY.body).toContain('recovery phrase stays the main key');
  });

  test('a passkey failure during setup can continue without it', () => {
    expect(setupLinks({ message: 'x', accountId: '0xabc', retry: 'passkey' })).toEqual(['skipPasskey', 'startOver']);
    expect(setupLinks({ message: 'x', retry: 'passkey' })).toEqual(['startOver']);
    expect(setupLinks({ message: 'x', retry: 'restart' })).toEqual(['startOver']);
    expect(setupLinks({ message: 'x', accountId: '0xabc', retry: 'messaging' })).toEqual([]);
    expect(setupLinks(null)).toEqual([]);
    expect(setupHint({ message: 'Dismissed.', accountId: '0xabc', retry: 'passkey' })).toContain('continue without a passkey');
  });
});

const FRESH: RestoreOfferInput = { custody: 'ecdsa-root', migration: null, passkeysAvailable: true, devicePasskeyStored: false };

describe('restoreOffer', () => {
  test('a recovery-phrase account is offered a passkey for this device, never required', () => {
    expect(restoreOffer(FRESH)).toBe('add-passkey');
    expect(restoreOffer({ ...FRESH, custody: 'undeployed' })).toBe('add-passkey');
    expect(RESTORE_OFFER_COPY['add-passkey'].message).toContain('later in Settings, Security');
  });

  test('no offer when passkeys are unavailable or this device already has one', () => {
    expect(restoreOffer({ ...FRESH, passkeysAvailable: false })).toBeNull();
    expect(restoreOffer({ ...FRESH, devicePasskeyStored: true })).toBeNull();
    expect(restoreOffer({ ...FRESH, custody: 'other-root' })).toBeNull();
    expect(restoreOffer({ ...FRESH, custody: null })).toBeNull();
  });

  test('a legacy passkey-rooted account is asked to migrate where it can, and told where to otherwise', () => {
    const legacy: RestoreOfferInput = { ...FRESH, custody: 'passkey-root' };
    expect(restoreOffer({ ...legacy, migration: 'recovery-key' })).toBe('make-root-here');
    expect(restoreOffer({ ...legacy, migration: 'device-passkey' })).toBe('make-root-here');
    expect(restoreOffer({ ...legacy, migration: 'passkey' })).toBe('make-root-here');
    expect(restoreOffer({ ...legacy, migration: 'elsewhere' })).toBe('make-root-elsewhere');
    expect(restoreOffer({ ...legacy, migration: null })).toBeNull();
    expect(restoreOffer({ ...legacy, migration: 'not-needed' })).toBeNull();
    expect(RESTORE_OFFER_COPY['make-root-elsewhere'].message).toContain('Messaging works on this device');
  });
});
