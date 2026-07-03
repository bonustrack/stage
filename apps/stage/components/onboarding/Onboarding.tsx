
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { WelcomeStep, RestoreStep, PasskeyStep, SetupStep } from './Onboarding.steps';
import { useOnboardingFlow } from './useOnboardingFlow';

export interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const f = useOnboardingFlow(onDone);

  return (
    <Col surface="surface" flex={1} padding={{ x: 24, top: 24 + insets.top, bottom: 16 + insets.bottom }}>
      {f.step === 'welcome' ? (
        <WelcomeStep pal={pal} dark={dark} busy={f.busy} onCreate={f.onCreate} onRestore={f.onRestore} />
      ) : null}

      {f.step === 'restore' ? (
        <RestoreStep
          pal={pal} dark={dark} busy={f.busy} phrase={f.phrase} err={f.err}
          onChange={f.onPhraseChange} onNext={f.onRestoreNext} onBack={f.onRestoreBack}
        />
      ) : null}

      {f.step === 'passkey' ? (
        <PasskeyStep pal={pal} dark={dark} busy={f.busy} onAdd={f.onAddPasskey} onSkip={f.onSkipPasskey} />
      ) : null}

      {f.step === 'setup' ? (
        <SetupStep
          pal={pal} dark={dark} busy={f.busy} stage={f.stage} setupErr={f.setupErr}
          onRetry={f.onSetupRetry} onBack={f.onSetupBack}
        />
      ) : null}
    </Col>
  );
}
