import { errorMessage } from '@stage-labs/client/errors';
import { useEffect, useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Text } from '@stage-labs/kit/react-native/text';
import { UsernameField, useUsernameInput } from '../profile/UsernameField';
import { USERNAME_COPY, normalizeLabel, usernameReady } from '../profile/username.model';
import { IntroCard } from '../chrome/IntroCard';
import { PAGE_INTRO_TYPE } from '../chrome/PageIntro.model';
import { FORM_FIELD_HEIGHT, FORM_FIELD_RADIUS } from '../FormField';
import { PlaceholderBar, PlaceholderBlock } from '../Placeholder';
import { Column } from '../layout';
import { useEffectiveColorScheme } from '../../lib/theme';
import { claimAndSetUpStageName, ownedStageName, setUpStageName } from '../../lib/profile';
import { reported } from '../../lib/errorPolicy';

const reportOwnedName = reported('settings.ownedName');

function useOwnedLabel(address: string): string | null | undefined {
  const [owned, setOwned] = useState<{ address: string; label: string | null } | null>(null);
  useEffect(() => {
    let cancelled = false;
    const settle = (label: string | null): void => {
      if (!cancelled) setOwned({ address, label });
    };
    void ownedStageName(address).then(
      (name) => {
        settle(name ? normalizeLabel(name) : null);
      },
      (err: unknown) => {
        reportOwnedName(err);
        settle(null);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [address]);
  return owned?.address === address ? owned.label : undefined;
}

const BUTTON_LG_HEIGHT = 48;
const ABOUT_LINES = ['100%', '70%'] as const;

function ClaimCardPlaceholder(): React.ReactElement {
  const about = (
    <Column>
      {ABOUT_LINES.map((width) => (
        <PlaceholderBar key={width} width={width} height={14} line={PAGE_INTRO_TYPE.about.lineHeight} center />
      ))}
    </Column>
  );
  return (
    <IntroCard title={USERNAME_COPY.title} about={about} footer={<PlaceholderBlock width="100%" height={BUTTON_LG_HEIGHT} />}>
      <PlaceholderBlock width="100%" height={FORM_FIELD_HEIGHT} radius={FORM_FIELD_RADIUS} />
    </IntroCard>
  );
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
    setUpStageName(address, label)
      .then(onDone)
      .catch((err: unknown) => {
        setError(errorMessage(err));
      })
      .finally(() => {
        setBusy(false);
      });
  };
  const footer = (
    <Button label={`Use @${label}`} block size="lg" color="primary" variant="solid" dark={dark} loading={busy} onPress={run} />
  );
  return (
    <IntroCard title={USERNAME_COPY.title} about={SET_PRIMARY_ABOUT} footer={footer}>
      {error ? <Text text={error} size="xs" color="secondary" /> : null}
    </IntroCard>
  );
}

export function ClaimStageName({ address, onClaimed }: { address: string; onClaimed: () => void }): React.ReactElement {
  const owned = useOwnedLabel(address);
  if (owned === undefined) return <ClaimCardPlaceholder />;
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
        await claimAndSetUpStageName(address, label);
        setState({ label, phase: 'claimed' });
        onClaimed();
      } catch (err) {
        setState({ label, phase: 'failed', detail: errorMessage(err) });
      }
    })();
  };

  const footer = (
    <Button
      label="Claim username"
      block
      size="lg"
      color="primary"
      variant="solid"
      dark={dark}
      loading={busy}
      disabled={!usernameReady(state, label)}
      onPress={claim}
    />
  );
  return (
    <IntroCard title={USERNAME_COPY.title} about={USERNAME_COPY.about} footer={footer}>
      <UsernameField input={input} busy={busy} />
    </IntroCard>
  );
}
