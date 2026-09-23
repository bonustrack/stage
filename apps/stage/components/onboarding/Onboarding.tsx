import { router, useLocalSearchParams } from 'expo-router';
import { useWindowDimensions } from 'react-native';
import { Icon, type HeroIconName } from '@stage-labs/kit/react-native/icon';
import { Box } from '../layout';
import { RailTooltip } from '../tabs/RailTooltip';
import { pageTopPadding } from '../chrome/PageIntro.model';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { PasskeyStep } from './Onboarding.steps';
import { SetupStep } from './Onboarding.setup';
import { ImportStep } from './Onboarding.import';
import { ProfileStep } from './Onboarding.profile';
import { UsernameStep } from './Onboarding.username';
import { useOnboardingFlow } from './useOnboardingFlow';
import { safeNextRoute } from './nextRoute.model';

export interface OnboardingProps {
  onDone: () => void;
}

const STEP_ICON_INSET = 16;

function StepIcon({ label, icon, side, onPress, top, color, disabled }: {
  label: string; icon: HeroIconName; side: 'left' | 'right'; onPress: () => void; top: number; color: string; disabled: boolean;
}): React.ReactElement {
  const edge = side === 'left' ? { left: STEP_ICON_INSET } : { right: STEP_ICON_INSET };
  return (
    <RailTooltip label={label} placement="below" onPress={() => { if (!disabled) onPress(); }}
      style={{ position: 'absolute', top, ...edge, zIndex: 1, opacity: disabled ? 0.5 : 1 }}>
      <Box padding={4}><Icon name={icon} size={24} color={color} /></Box>
    </RailTooltip>
  );
}

type Flow = ReturnType<typeof useOnboardingFlow>;

function stepBack(f: Flow): (() => void) | null {
  if (f.step === 'profile') return f.onProfileBack;
  if (f.step === 'passkey') return f.onPasskeyBack;
  return null;
}

function stepSkip(f: Flow): (() => void) | null {
  if (f.step === 'username') return () => { f.onUsernameContinue(''); };
  if (f.step === 'profile') return f.onProfileSkip;
  if (f.step === 'passkey' && f.passkeyMode === 'add' && f.passkeyErr === null) return f.onSkipPasskey;
  return null;
}

function StepChrome({ f, top, color }: { f: Flow; top: number; color: string }): React.ReactElement {
  const back = stepBack(f);
  const skip = stepSkip(f);
  return (
    <>
      {back === null ? null : <StepIcon label="Back" icon="arrowNarrowLeft" side="left" onPress={back} top={top} color={color} disabled={f.busy} />}
      {skip === null ? null : <StepIcon label="Skip" icon="arrowNarrowRight" side="right" onPress={skip} top={top} color={color} disabled={f.busy} />}
    </>
  );
}

const KEPT_STEPS = new Set(['username', 'profile', 'passkey']);

function KeptStep({ f, own, children }: { f: Flow; own: 'username' | 'profile'; children: React.ReactNode }): React.ReactElement | null {
  if (!KEPT_STEPS.has(f.step)) return null;
  return <Col width="100%" align="center" style={{ display: f.step === own ? 'flex' : 'none' }}>{children}</Col>;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const f = useOnboardingFlow(onDone);

  return (
    <Col surface="surface" flex={1} align="center" justify="start" padding={{ top: pageTopPadding(height) + insets.top, bottom: 24 + insets.bottom }}>
      <StepChrome f={f} top={STEP_ICON_INSET + insets.top} color={pal.link} />
      <KeptStep f={f} own="username"><UsernameStep dark={dark} busy={f.busy} onContinue={f.onUsernameContinue} /></KeptStep>
      <KeptStep f={f} own="profile"><ProfileStep dark={dark} busy={f.busy} onContinue={f.onProfileContinue} /></KeptStep>
      {f.step === 'import' ? (
        <ImportStep dark={dark} busy={f.busy} onTransfer={f.onImportTransfer} />
      ) : null}
      {f.step === 'passkey' ? (
        <PasskeyStep dark={dark} busy={f.busy} mode={f.passkeyMode} error={f.passkeyErr}
          onAdd={f.onAddPasskey} onStartOver={f.onSetupBack} />
      ) : null}
      {f.step === 'setup' ? (
        <SetupStep
          dark={dark} busy={f.busy} stage={f.stage} setupErr={f.setupErr} plan={f.plan}
          onRetry={f.onSetupRetry} onBack={f.onSetupBack} history={f.history}
        />
      ) : null}
    </Col>
  );
}

export function OnboardingPage(): React.ReactElement {
  const { next } = useLocalSearchParams<{ next?: string }>();
  return <Onboarding onDone={() => { router.replace(safeNextRoute(next)); }} />;
}
