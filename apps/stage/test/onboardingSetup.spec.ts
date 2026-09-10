import { describe, expect, test } from 'bun:test';
import {
  setupHint, setupProgress, setupStages, setupTitle, stageState,
} from '../components/onboarding/Onboarding.setup.model';

describe('setupStages', () => {
  test('adds the history stage only for imports and restores', () => {
    expect(setupStages(false)).toEqual(['wallet', 'messaging', 'finishing']);
    expect(setupStages(true)).toEqual(['wallet', 'messaging', 'history', 'finishing']);
  });
});

describe('setupProgress', () => {
  const stages = setupStages(true);

  test('starts each stage just past its boundary and never finishes it early', () => {
    expect(setupProgress('wallet', stages, 0)).toBeCloseTo(0.1 / 4);
    expect(setupProgress('wallet', stages, 999_999)).toBeCloseTo(0.9 / 4);
    expect(setupProgress('history', stages, 60_000)).toBeCloseTo((2 + 0.1 + 0.4) / 4);
  });

  test('caps at one and ignores unknown stages', () => {
    expect(setupProgress('finishing', stages, 10_000)).toBeLessThanOrEqual(1);
    expect(setupProgress('history', setupStages(false), 0)).toBe(0);
  });
});

describe('stageState', () => {
  test('marks earlier stages done and later ones pending', () => {
    const stages = setupStages(true);
    expect(stageState('wallet', 'history', stages)).toBe('done');
    expect(stageState('history', 'history', stages)).toBe('active');
    expect(stageState('finishing', 'history', stages)).toBe('pending');
  });
});

describe('setup copy', () => {
  test('switches to the retry title and hint on error', () => {
    expect(setupTitle('messaging', null)).toBe('Setting up secure messaging');
    expect(setupTitle('messaging', { message: 'x' })).toBe('Setup needs another try');
    expect(setupHint('messaging', { message: 'boom' })).toContain('boom');
    expect(setupHint('messaging', { message: 'boom', accountId: '0xabc' })).toContain('wallet is ready');
  });
});
