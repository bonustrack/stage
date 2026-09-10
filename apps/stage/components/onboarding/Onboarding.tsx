
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Col } from '../layout';
import { usePalette, useEffectiveColorScheme } from '../../lib/theme';
import { WelcomeStep, RestoreStep, PasskeyStep } from './Onboarding.steps';
import { SetupStep } from './Onboarding.setup';
import { ImportStep } from './Onboarding.import';
import { useOnboardingFlow } from './useOnboardingFlow';
import { StageLogo } from './StageLogo';

export interface OnboardingProps {
  onDone: () => void;
}

const BLOCK_MAX_WIDTH = 520;
const BLOCK_MIN_HEIGHT = 600;
const BLOCK_MAX_HEIGHT = 1000;
const CARD_BREAKPOINT = 700;
const LOGO_SIZE = 64;
const CARD_RADIUS = 12;

function useBlockLayout(): { card: boolean; minHeight: number } {
  const { width, height } = useWindowDimensions();
  return { card: width >= CARD_BREAKPOINT, minHeight: Math.min(BLOCK_MIN_HEIGHT, Math.max(0, height - 48)) };
}

export function Onboarding({ onDone }: OnboardingProps): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const pal = usePalette();
  const insets = useSafeAreaInsets();
  const f = useOnboardingFlow(onDone);
  const block = useBlockLayout();

  return (
    <Col surface="surface" flex={1} align="center" justify="center" padding={{ x: 24, top: 24 + insets.top, bottom: 16 + insets.bottom }}>
      <Col
        width="100%"
        maxWidth={BLOCK_MAX_WIDTH}
        padding={block.card ? 32 : 0}
        style={block.card
          ? {
              height: '85%', minHeight: block.minHeight, maxHeight: BLOCK_MAX_HEIGHT,
              borderRadius: CARD_RADIUS, borderWidth: 1, borderColor: pal.border,
            }
          : { flex: 1 }}
      >
      <Col align="center" padding={{ bottom: 24 }}>
        <StageLogo size={LOGO_SIZE} color={pal.primary} />
      </Col>
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
