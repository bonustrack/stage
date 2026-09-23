import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { UsernameField, useUsernameInput } from '../UsernameField';
import { USERNAME_COPY, usernameReady } from '../UsernameField.model';
import { normalizeLabel } from './ProfileSettings.claim.model';
import { OnboardingCard } from '../onboarding/OnboardingCard';
import { useEffectiveColorScheme } from '../../lib/theme';
import { claimStageName, ownedStageName, setPrimaryStageName } from '../../lib/claimName';

function useOwnedLabel(address: string): string | null {
  const [owned, setOwned] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    void ownedStageName(address).then((name) => {
      if (!cancelled) setOwned(name ? normalizeLabel(name) : null);
    });
    return () => { cancelled = true; };
  }, [address]);
  return owned;
}

const SET_PRIMARY_ABOUT = 'You already claimed this username. One signature makes it the name people see.';

function SetPrimaryCard({ address, label, onDone }: { address: string; label: string; onDone: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = (): void => {
    if (busy) return;
    setBusy(true);
    setError(null);
    setPrimaryStageName(address, label)
      .then(onDone)
      .catch((err: unknown) => { setError(errorMessage(err)); })
      .finally(() => { setBusy(false); });
  };
  const footer = (
    <Button label={`Use @${label}`} block size="lg" color="primary" variant="solid" dark={dark} loading={busy} onPress={run} />
  );
  return (
    <OnboardingCard title={USERNAME_COPY.title} about={SET_PRIMARY_ABOUT} footer={footer}>
      {error ? <Text value={error} size="md" color="secondary" /> : null}
    </OnboardingCard>
  );
}

export function ClaimStageName({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const owned = useOwnedLabel(address);
  if (owned !== null) return <SetPrimaryCard address={address} label={owned} onDone={onClaimed} />;
  return <ClaimForm address={address} onClaimed={onClaimed} />;
}

function ClaimForm({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const dark = useEffectiveColorScheme() === 'dark';
  const input = useUsernameInput();
  const { label, state, setState } = input;
  const busy = state.phase === 'claiming';

  const claim = (): void => {
    if (!usernameReady(state, label)) return;
    setState({ label, phase: 'claiming' });
    void (async (): Promise<void> => {
      try {
        await claimStageName(label);
        await setPrimaryStageName(address, label);
        setState({ label, phase: 'claimed' });
        onClaimed();
      } catch (err) {
        setState({ label, phase: 'failed', detail: errorMessage(err) });
      }
    })();
  };

  const footer = (
    <Button label="Claim username" block size="lg" color="primary" variant="solid" dark={dark}
      loading={busy} disabled={!usernameReady(state, label)} onPress={claim} />
  );
  return (
    <OnboardingCard title={USERNAME_COPY.title} about={USERNAME_COPY.about} footer={footer}>
      <UsernameField input={input} busy={busy} />
    </OnboardingCard>
  );
}
