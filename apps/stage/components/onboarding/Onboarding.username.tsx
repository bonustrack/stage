import { useState } from 'react';
import { Button } from '@stage-labs/kit/react-native/button';
import { Icon } from '@stage-labs/kit/react-native/icon';
import { FormField } from '../FormField';
import { Spinner } from '../Spinner';
import { OnboardingCard } from './OnboardingCard';
import { usePalette } from '../../lib/theme';
import { useNameAvailability } from '../settings/useNameAvailability';
import { claimStatusTone, normalizeLabel, sanitizeLabelInput, type ClaimState } from '../settings/ProfileSettings.claim.model';
import { RailTooltip } from '../tabs/RailTooltip';
import { canContinueUsername, usernameHint, usernameStatus } from './Onboarding.profile.model';
import { randomUsername } from '../../lib/randomUsername';

type Pal = ReturnType<typeof usePalette>;

const USERNAME_TITLE = 'Pick a username';
const USERNAME_ABOUT = 'Claim a free username so people can find you on Stage.';
const STATUS_ICON = 24;

const NOOP = (): void => undefined;
const SHUFFLE_ICON = 16;

function ShuffleButton({ pal, disabled, onPick }: { pal: Pal; disabled: boolean; onPick: (label: string) => void }): React.ReactElement {
  return (
    <RailTooltip label="Random username" onPress={() => { if (!disabled) void randomUsername().then(onPick); }} style={undefined}>
      <Icon name="switchHorizontal" size={SHUFFLE_ICON} color={pal.sub} />
    </RailTooltip>
  );
}

function StatusMark({ state, label, pal }: { state: ClaimState; label: string; pal: Pal }): React.ReactElement | undefined {
  const status = usernameStatus(state, label);
  if (status === null) return undefined;
  if (status.kind === 'checking') return <Spinner size={STATUS_ICON} color={pal.sub} />;
  const ok = status.kind === 'ok';
  return (
    <RailTooltip label={status.tip} onPress={NOOP} style={undefined}>
      <Icon name={ok ? 'checkCircle' : 'xCircle'} variant="solid" size={STATUS_ICON} color={ok ? pal.success : pal.danger} />
    </RailTooltip>
  );
}

export function UsernameStep({ pal, dark, busy, onContinue }: {
  pal: Pal; dark: boolean; busy: boolean;
  onContinue: (label: string) => void;
}): React.ReactElement {
  const [raw, setRaw] = useState('');
  const [state, setState] = useState<ClaimState>({ label: '', phase: 'idle' });
  const label = normalizeLabel(raw);
  useNameAvailability(label, setState);
  const footer = (
    <Button dark={dark} size="lg" fullWidth pill tintBg={pal.primary} tintFg={pal.bg}
      label="Continue" disabled={busy || !canContinueUsername(state, label)}
      onPress={() => { onContinue(label); }} />
  );
  return (
    <OnboardingCard title={USERNAME_TITLE} about={USERNAME_ABOUT} footer={footer}>
      <FormField label="Username" placeholder="e.g. alice123" value={raw} onChangeText={(t) => { setRaw(sanitizeLabelInput(t)); }} disabled={busy}
        labelTrailing={<ShuffleButton pal={pal} disabled={busy} onPick={setRaw} />}
        inputProps={{ autoCapitalize: 'none', autoCorrect: false }}
        trailing={StatusMark({ state, label, pal })}
        hint={usernameHint(state, label)} hintTone={claimStatusTone(state)} />
    </OnboardingCard>
  );
}
