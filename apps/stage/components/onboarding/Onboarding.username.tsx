import { Button } from '@stage-labs/kit/react-native/button';
import { useRouter } from 'expo-router';
import { OnboardingCard, SkipLink } from './OnboardingCard';
import { IMPORT_ROUTE } from './nextRoute.model';
import { usePalette } from '../../lib/theme';
import { UsernameField, useUsernameInput } from '../UsernameField';
import { USERNAME_COPY, usernameReady } from '../UsernameField.model';

export function UsernameStep({ dark, busy, onContinue }: {
  dark: boolean; busy: boolean;
  onContinue: (label: string) => void;
}): React.ReactElement {
  const pal = usePalette();
  const router = useRouter();
  const input = useUsernameInput();
  const footer = (
    <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
      label="Continue" disabled={busy || !usernameReady(input.state, input.label)}
      onPress={() => { onContinue(input.label); }} />
  );
  return (
    <OnboardingCard
      title={USERNAME_COPY.title} about={USERNAME_COPY.about} footer={footer}
      after={<SkipLink label="Or import" disabled={busy} onPress={() => { router.navigate(IMPORT_ROUTE); }} />}
    >
      <UsernameField input={input} busy={busy} />
    </OnboardingCard>
  );
}
