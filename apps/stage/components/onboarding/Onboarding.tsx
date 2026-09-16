import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { PasskeyStep } from './Onboarding.steps';
import { SetupStep } from './Onboarding.setup';
import { ImportStep } from './Onboarding.import';
import { ProfileStep } from './Onboarding.profile';
import { useOnboardingFlow } from './useOnboardingFlow';
import { safeNextRoute } from './nextRoute.model';

export interface OnboardingProps {
  onDone: () => void;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const f = useOnboardingFlow(onDone);

  return (
    <Col surface="surface" flex={1} align="center" justify="center" padding={{ x: 24, top: 24 + insets.top, bottom: 16 + insets.bottom }}>
      {f.step === 'profile' ? (
        <ProfileStep pal={pal} dark={dark} busy={f.busy} onContinue={f.onProfileContinue} />
      ) : null}
      {f.step === 'import' ? (
        <ImportStep pal={pal} dark={dark} busy={f.busy} onTransfer={f.onImportTransfer} />
      ) : null}
      {f.step === 'passkey' ? (
        <PasskeyStep dark={dark} busy={f.busy} mode={f.passkeyMode} error={f.passkeyErr}
          onAdd={f.onAddPasskey} onSkip={f.onSkipPasskey} onStartOver={f.onSetupBack} />
      ) : null}
      {f.step === 'setup' ? (
        <SetupStep
          pal={pal} dark={dark} busy={f.busy} stage={f.stage} setupErr={f.setupErr} plan={f.plan}
          onRetry={f.onSetupRetry} onBack={f.onSetupBack} onSkipHistory={f.onSkipHistory}
        />
      ) : null}
    </Col>
  );
}

export function OnboardingPage(): React.ReactElement {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <Onboarding onDone={() => { router.replace(safeNextRoute(next)); }} />;
}
