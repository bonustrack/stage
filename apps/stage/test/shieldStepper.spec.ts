import { describe, expect, test } from 'bun:test';
import { shieldStepperSteps } from '../app/wallet/send.shield.stepper.model';

const LABELS = [
  'Submitting transaction',
  'Confirming on-chain',
  'Scanning into private balance',
  'Shielded',
];

describe('shieldStepperSteps', () => {
  test('idle marks every step pending', () => {
    const steps = shieldStepperSteps('idle', 0);
    expect(steps.map(s => s.label)).toEqual(LABELS);
    expect(steps.map(s => s.state)).toEqual(['pending', 'pending', 'pending', 'pending']);
  });

  test('a mid stage marks earlier steps done and the current one active', () => {
    expect(shieldStepperSteps('confirming', 0).map(s => s.state)).toEqual([
      'done', 'active', 'pending', 'pending',
    ]);
  });

  test('the active scanning step carries the slowness hint', () => {
    const steps = shieldStepperSteps('scanning', 0);
    expect(steps[2]?.state).toBe('active');
    expect(steps[2]?.hint).toBe('This can take a few minutes…');
    expect(steps.filter(s => s.hint !== undefined)).toHaveLength(1);
  });

  test('done marks every step done', () => {
    expect(shieldStepperSteps('done', 0).map(s => s.state)).toEqual([
      'done', 'done', 'done', 'done',
    ]);
  });

  test('error marks steps before errorAt done and the rest pending', () => {
    expect(shieldStepperSteps('error', 2).map(s => s.state)).toEqual([
      'done', 'done', 'error', 'pending',
    ]);
  });
});
