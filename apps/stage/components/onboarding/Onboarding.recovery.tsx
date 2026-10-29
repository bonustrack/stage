import { ProfileStep } from './Onboarding.profile';
import { profileSetupFrom, type ProfileSetup } from './Onboarding.profile.model';
import type { EditableProfile } from '../../lib/onboarding.core';
import { UsernameField, useUsernameInput } from '../UsernameField';
import { usernameReady } from '../UsernameField.model';
import { FormField } from '../FormField';

export function ProfileRecoveryStep({
  recovery,
  dark,
  busy,
  onSave,
}: {
  recovery: EditableProfile;
  dark: boolean;
  busy: boolean;
  onSave: (profile: ProfileSetup) => void;
}): React.ReactElement {
  const { profile, labelLocked } = recovery;
  const input = useUsernameInput(labelLocked ? '' : profile.label);
  const label = labelLocked ? profile.label : input.label;
  const before = labelLocked ? (
    <FormField
      label="Username"
      value={profile.label}
      onChangeText={() => undefined}
      disabled
      hint="Continue with this wallet's registered username."
    />
  ) : (
    <UsernameField input={input} busy={busy} />
  );
  return (
    <ProfileStep
      dark={dark}
      busy={busy}
      before={before}
      continueDisabled={!labelLocked && !usernameReady(input.state, input.label)}
      initial={{ displayName: profile.displayName ?? '', description: profile.description ?? '', image: profile.image ?? null }}
      onContinue={(details) => {
        const next = profileSetupFrom(label, details);
        if (next !== null) onSave(next);
      }}
    />
  );
}
