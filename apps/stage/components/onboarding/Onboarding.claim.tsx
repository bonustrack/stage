import { errorMessage } from '@stage-labs/client/errors';
import { Button } from '@stage-labs/kit/react-native/button';
import { claimStageName } from '../../lib/profile';
import { SignInCancelled } from '../../lib/signInCancelled';
import { usePalette } from '../../lib/theme';
import { UsernameField, useUsernameInput } from '../UsernameField';
import { USERNAME_COPY, usernameReady } from '../UsernameField.model';
import { OnboardingCard, SkipLink } from './OnboardingCard';

export function ClaimStep({ dark, onDone }: { dark: boolean; onDone: () => void }): React.ReactElement {
  const pal = usePalette();
  const input = useUsernameInput();
  const { label, state, setState } = input;
  const busy = state.phase === 'claiming';
  const claim = (): void => {
    if (!usernameReady(state, label)) return;
    setState({ label, phase: 'claiming' });
    claimStageName(label)
      .then(() => {
        setState({ label, phase: 'claimed' });
        onDone();
      })
      .catch((err: unknown) => {
        setState(err instanceof SignInCancelled ? { label, phase: 'available' } : { label, phase: 'failed', detail: errorMessage(err) });
      });
  };
  const footer = (
    <Button
      variant="primary"
      dark={dark}
      size="lg"
      fullWidth
      pill
      tintBg={pal.primary}
      tintFg={pal.bg}
      label="Continue"
      loading={busy}
      disabled={busy || !usernameReady(state, label)}
      onPress={claim}
    />
  );
  return (
    <OnboardingCard
      title={USERNAME_COPY.title}
      about={USERNAME_COPY.about}
      footer={footer}
      after={<SkipLink label="Skip for now" disabled={busy} onPress={onDone} />}
    >
      <UsernameField input={input} busy={busy} />
    </OnboardingCard>
  );
}
