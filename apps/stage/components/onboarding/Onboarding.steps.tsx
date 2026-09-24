import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { usePalette } from '../../lib/theme';
import { OnboardingCard } from './OnboardingCard';
import { PASSKEY_STEP_COPY } from './Onboarding.steps.model';

export function PasskeyStep({ dark, busy, onAdd }: {
  dark: boolean; busy: boolean; onAdd: () => void;
}): React.ReactElement {
  const pal = usePalette();
  const copy = PASSKEY_STEP_COPY;
  const footer = (
    <Button label={copy.action} block pill size="lg" color="primary" variant="solid" disabled={busy} dark={dark} onPress={onAdd}
      iconStart={<Icon name="fingerPrint" size={20} color={pal.bg} />} />
  );
  return <OnboardingCard title={copy.title} about={copy.body} footer={footer} />;
}
