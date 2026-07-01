import { describe, test } from 'bun:test';
import { onboardingStep } from '../src/onboarding/onboardingStep';
import { snap } from './helpers';

describe('onboardingStep', () => {
  test('minimal', () => {
    snap(onboardingStep({ title: 'Welcome to Stage' }));
  });

  test('full', () => {
    snap(
      onboardingStep({
        title: 'Create your account',
        caption: 'Your keys stay on this device.',
        imageUri: 'https://img.example/onboarding.png',
        topPadding: 24,
        captionSize: 'md',
        actionPressType: 'custom.action',
        actions: [
          { id: 'create', label: 'Create account' },
          { id: 'import', label: 'Import', variant: 'soft', disabled: true },
        ],
      }),
    );
  });
});
