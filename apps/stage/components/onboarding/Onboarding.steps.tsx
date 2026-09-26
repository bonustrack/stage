import { Button } from '@stage-labs/kit/react-native/button';
import { Glyph } from '@stage-labs/kit/react-native/glyph';
import { usePalette } from '../../lib/theme';
import { OnboardingCard } from './OnboardingCard';
import { PASSKEY_STEP_COPY } from './Onboarding.steps.model';
import { IconFingerPrint1 } from '@central-icons-react-native/round-outlined-radius-1-stroke-2/IconFingerPrint1';

export function PasskeyStep({ dark, busy, onAdd }: {
  dark: boolean; busy: boolean; onAdd: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const copy = PASSKEY_STEP_COPY;
  const footer = (
    <Button label={copy.action} block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd}
      iconStart={<Glyph icon={IconFingerPrint1} size={20} color={pal.bg} />} />
  );
  return <OnboardingCard title={copy.title} about={copy.body} footer={footer} />;
}
