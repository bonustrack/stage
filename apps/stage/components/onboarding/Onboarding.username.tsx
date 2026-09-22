import { Button } from '@stage-labs/kit/react-native/button';
import { OnboardingCard } from './OnboardingCard';
import { usePalette } from '../../lib/theme';
import { UsernameField, useUsernameInput } from '../UsernameField';
import { USERNAME_COPY, usernameReady } from '../UsernameField.model';

type Pal = ReturnType<typeof usePalette>;

export function UsernameStep({ pal, dark, busy, onContinue }: {
  pal: Pal; dark: boolean; busy: boolean;
  onContinue: (label: string) => void;
}): React.ReactElement {
  const input = useUsernameInput();
  const footer = (
    <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
      label="Continue" disabled={busy || !usernameReady(input.state, input.label)}
      onPress={() => { onContinue(input.label); }} />
  );
  return (
    <OnboardingCard title={USERNAME_COPY.title} about={USERNAME_COPY.about} footer={footer}>
      <UsernameField input={input} busy={busy} />
    </OnboardingCard>
  );
}
