
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { WelcomeStep, RestoreStep, PasskeyStep } from './Onboarding.steps';
import { SetupStep } from './Onboarding.setup';
import { ImportStep } from './Onboarding.import';
import { useOnboardingFlow } from './useOnboardingFlow';

export interface OnboardingProps {
  onDone: () => void;
}

const ONBOARDING_MAX_WIDTH = 560;

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const f = useOnboardingFlow(onDone);

  return (
    <Col surface="surface" flex={1} align="center" padding={{ x: 24, top: 24 + insets.top, bottom: 16 + insets.bottom }}>
      <Col flex={1} width="100%" maxWidth={ONBOARDING_MAX_WIDTH}>
      {f.step === 'welcome' ? (
        <WelcomeStep pal={pal} dark={dark} busy={f.busy} onCreate={f.onCreate} onRestore={f.onRestore} onImport={f.onImport} />
      ) : null}

      {f.step === 'restore' ? (
        <RestoreStep
          pal={pal} dark={dark} busy={f.busy} phrase={f.phrase} err={f.err}
          onChange={f.onPhraseChange} onNext={f.onRestoreNext} onBack={f.onRestoreBack}
        />
      ) : null}

      {f.step === 'import' ? (
        <ImportStep pal={pal} dark={dark} busy={f.busy} onTransfer={f.onImportTransfer} onBack={f.onRestoreBack} />
      ) : null}

      {f.step === 'passkey' ? (
        <PasskeyStep pal={pal} dark={dark} busy={f.busy} onAdd={f.onAddPasskey} onSkip={f.onSkipPasskey} />
      ) : null}

      {f.step === 'setup' ? (
        <SetupStep
          pal={pal} dark={dark} busy={f.busy} stage={f.stage} setupErr={f.setupErr} withHistory={f.withHistory}
          onRetry={f.onSetupRetry} onBack={f.onSetupBack} onSkipHistory={f.onSkipHistory}
        />
      ) : null}
      </Col>
    </Col>
  );
}
