
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from '../../lib/safeArea';
import { Scroll } from '@stage-labs/kit/react-native/scroll';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { PasskeyStep } from './Onboarding.steps';
import { SetupStep } from './Onboarding.setup';
import { ImportStep } from './Onboarding.import';
import { ProfileStep } from './Onboarding.profile';
import { useOnboardingFlow } from './useOnboardingFlow';
import { StageLogo } from './StageLogo';

export interface OnboardingProps {
  onDone: () => void;
}

const BLOCK_MAX_WIDTH = 520;
const CARD_BREAKPOINT = 700;
const CARD_RADIUS = 12;
const HEADER_LOGO_SIZE = 48;

function useCardLayout(): boolean {
  return useWindowDimensions().width >= CARD_BREAKPOINT;
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const f = useOnboardingFlow(onDone);
  const card = useCardLayout();

  return (
    <Col surface="surface" flex={1} align="center" justify="center" gap={24} padding={{ x: 24, top: 24 + insets.top, bottom: 16 + insets.bottom }}>
      <StageLogo size={HEADER_LOGO_SIZE} color={pal.primary} />
      <Col
        width="100%"
        maxWidth={BLOCK_MAX_WIDTH}
        padding={card ? 32 : 20}
        style={[{ borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: pal.border }, card ? null : { flex: 1 }]}
      >
      <Scroll
        style={card ? { alignSelf: 'stretch' } : { flex: 1, alignSelf: 'stretch' }}
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
      {f.step === 'profile' ? (
        <ProfileStep pal={pal} dark={dark} busy={f.busy} onContinue={f.onProfileContinue} onBack={f.onProfileBack} />
      ) : null}

      {f.step === 'import' ? (
        <ImportStep pal={pal} dark={dark} busy={f.busy} onTransfer={f.onImportTransfer} onBack={f.onImportBack} />
      ) : null}

      {f.step === 'passkey' ? (
        <PasskeyStep dark={dark} busy={f.busy} onAdd={f.onAddPasskey} onSkip={f.onSkipPasskey} />
      ) : null}

      {f.step === 'setup' ? (
        <SetupStep
          pal={pal} dark={dark} busy={f.busy} stage={f.stage} setupErr={f.setupErr} withHistory={f.withHistory} withProfile={f.withProfile}
          onRetry={f.onSetupRetry} onBack={f.onSetupBack} onSkipHistory={f.onSkipHistory}
        />
      ) : null}
      </Scroll>
      </Col>
    </Col>
  );
}
